import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed, MapPin, Search, Plus, X, House, LogOut, ImagePlus, LoaderCircle, SlidersHorizontal } from 'lucide-react';
import { supabase } from './lib/supabase';

const DEFAULT_CENTER = [20, 0];
const FALLBACK_HOUSE_PHOTOS = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=900&q=80',
];
const icon = (color) => L.divIcon({ className: 'pin-wrap', html: `<div class="map-pin" style="--pin:${color}"><span class="pin-house"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1v-8Z"/><path d="M12 4v3"/></svg></span></div>`, iconSize: [40, 50], iconAnchor: [20, 48] });
const normalIcon = icon('#df8b32');
const mineIcon = icon('#3f7764');
const liveIcon = L.divIcon({ className: 'live-location-wrap', html: '<div class="live-location"><span></span></div>', iconSize: [28, 28], iconAnchor: [14, 14] });
const HOME_PATH = '/home';
const NESTPIN_PATH = '/nestpin';

function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function ListingPreview({ item }) {
  return <div className="listing-preview">{item.photos?.[0] ? <img className="preview-photo" src={item.photos[0]} alt={`${item.title} home`} onError={event => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling.hidden = false; }} /> : null}<div className="preview-placeholder" hidden={Boolean(item.photos?.[0])}><House size={25} /><span>Photo unavailable</span></div><div className="preview-copy"><strong>{item.title}</strong><span>{item.price} / month</span><small>{item.bedrooms ? `${item.bedrooms} bedroom${item.bedrooms === '1' ? '' : 's'} · ` : ''}{item.address}</small></div></div>;
}

function ListingGallery({ item }) {
  const photos = item.photos || [];
  return <div className="listing-gallery">{photos.length ? photos.map((photo, index) => <img key={photo} src={photo} alt={`${item.title} home ${index + 1}`} onError={event => { event.currentTarget.classList.add('image-error'); }} />) : <div className="gallery-empty"><House size={34} /><span>No photos available</span></div>}</div>;
}

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return undefined;

    map.flyTo(center, zoom || map.getZoom(), { animate: true, duration: 0.8 });
  }, [center, zoom, map]);

  return null;
}
function MapClick({ onPick, enabled }) {
  useMapEvents({ click: (event) => enabled && onPick([event.latlng.lat, event.latlng.lng]) });
  return null;
}
function distance(a, b) {
  const r = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function fallbackHousePhoto(id) {
  const index = [...id].reduce((total, character) => total + character.charCodeAt(0), 0) % FALLBACK_HOUSE_PHOTOS.length;
  return FALLBACK_HOUSE_PHOTOS[index];
}

function AuthPanel({ onAuthed, onInstall, canInstall }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const chooseMode = nextMode => { setMode(nextMode); setError(''); setSuccess(''); window.setTimeout(() => document.querySelector('.auth-form input')?.focus(), 0); };
  useEffect(() => { const actions = document.querySelector('.landing-actions'); if (!actions || actions.querySelector('.install-button')) return undefined; const button = document.createElement('button'); button.className = 'install-button light'; button.type = 'button'; button.title = 'Add Nestpin to your home screen'; button.textContent = '+ Add to home screen'; button.addEventListener('click', onInstall); actions.insertBefore(button, actions.querySelector('.nav-cta')); return () => button.remove(); }, [onInstall]);
  const submit = async (event) => {
    event.preventDefault(); if (busy) return; setError(''); setSuccess(''); setBusy(true);

    try {
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password })
        : await supabase.auth.signUp({
            email: form.email.trim(),
            password: form.password,
            options: {
              emailRedirectTo: window.location.origin,
              data: { display_name: form.name.trim() },
            },
          });

      if (result.error) {
        if (mode === 'signup' && /already|registered|exists|user.*found/i.test(result.error.message)) {
          return setError('This email already exists. Please enter another email address.');
        }
        return setError(result.error.message);
      }

      if (mode === 'signup' && result.data.user && Array.isArray(result.data.user.identities) && result.data.user.identities.length === 0) {
        return setError('This email already exists. Please enter another email address.');
      }

      if (mode === 'signup' && !result.data.session) {
        setSuccess('Account created. Check your email to confirm your account, then sign in.');
        setForm(current => ({ ...current, password: '' }));
        return;
      }

      onAuthed(result.data.user, mode === 'signup' ? form.name.trim() : null);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="auth-screen"><header className="landing-nav"><div className="brand"><span className="brand-mark"><House size={17} /></span> nestpin</div><div className="landing-actions"><button className="nav-link" onClick={() => chooseMode('login')}>Log in</button><button className="button nav-cta" onClick={() => chooseMode('signup')}>Sign up free</button></div></header><main className="landing-grid"><section className="landing-copy"><div className="landing-kicker"><span className="live-dot" /> Local homes. Better found.</div><h1>Make your next move feel <em>closer.</em></h1><p className="landing-lede">Nestpin turns the search for a home into a map you can actually feel. Discover places around you, share yours, and move with confidence.</p><div className="landing-proof"><div><strong>01</strong><span>Drop a pin<br />where it matters</span></div><div><strong>∞</strong><span>Homes worth<br />coming home to</span></div><div><strong>24/7</strong><span>Explore on<br />your own terms</span></div></div><div className="landing-visual"><img src={FALLBACK_HOUSE_PHOTOS[1]} alt="Modern home discovered on Nestpin" /><div className="visual-pin"><MapPin size={16} /><span>Find your place</span></div><div className="visual-caption"><span className="eyebrow">A calmer way to search</span><strong>From first look to front door.</strong></div></div></section><aside className="auth-panel auth-form"><div className="auth-panel-head"><span className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Start exploring'}</span><h2>{mode === 'login' ? 'Your next place is waiting.' : 'Find a place that feels like yours.'}</h2><p className="muted">{mode === 'login' ? 'Pick up where you left off.' : 'Create your free account and start exploring.'}</p></div><div className="tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => chooseMode('login')}>Log in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => chooseMode('signup')}>Create account</button></div><form onSubmit={submit}>
      {mode === 'signup' && <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Display name" required />}
      <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email address" required />
      <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Password" minLength="6" required />
      {error && <div className="error" role="alert">{error}</div>}
      {success && <div className="success" role="status">{success}</div>}
      <button className="button primary wide" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</> : mode === 'login' ? 'Continue to Nestpin' : 'Create my account'}</button>
    </form><p className="auth-note">Private by design. Your search stays yours.</p></aside></main><footer className="landing-footer"><span>Built for the way people really move.</span><span><i /> Discover nearby <i /> Share your space <i /> Find your fit</span></footer></div>;
}

function LocationPanel({ user, existing, onComplete }) {
  const [name, setName] = useState(existing?.display_name || user.user_metadata?.display_name || '');
  const [query, setQuery] = useState(existing?.location_name || '');
  const [location, setLocation] = useState(existing?.latitude ? [existing.latitude, existing.longitude] : null);
  const [error, setError] = useState(''); const [searching, setSearching] = useState(false); const [saving, setSaving] = useState(false);
  const search = async () => {
    if (!query.trim() || searching) return; setSearching(true); setError('');
    try { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`); const data = await res.json();
      if (!data[0]) setError('No matching place found.'); else { setLocation([+data[0].lat, +data[0].lon]); setQuery(data[0].display_name); }
    } catch { setError('Location search is unavailable. Try again.'); } finally { setSearching(false); }
  };
  const save = async (event) => { event.preventDefault(); if (!name.trim() || !location) return setError('Add your name and select a location.'); if (saving) return; setSaving(true); setError('');
    try { const { error: saveError } = await supabase.from('profiles').upsert({ id: user.id, display_name: name.trim(), location_name: query || 'Selected map location', latitude: location[0], longitude: location[1] });
      if (saveError) setError(saveError.message); else onComplete({ display_name: name.trim(), location_name: query, latitude: location[0], longitude: location[1] });
    } catch (err) { setError(err?.message || 'Unable to save your profile right now.'); } finally { setSaving(false); }
  };
  return <div className="location-overlay"><div className="location-card"><div className="step-count">01 / 01</div><h2>Where are you looking?</h2><p className="muted">Set your home base so Nestpin can show relevant places around you.</p>
    <form onSubmit={save}><label>Your display name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. maya_r" /></label><label>Your area<div className="search-field"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), search())} placeholder="Search city or region" /><button type="button" onClick={search} disabled={searching}>{searching ? <LoaderCircle className="spin" size={17} /> : 'Find'}</button></div></label><p className="helper">Search a place, or click anywhere on the map to fine-tune your area.</p>{error && <div className="error" role="alert">{error}</div>}<button className="button primary wide" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={17} /> Saving...</> : <>Start exploring <MapPin size={17} /></>}</button></form>
  </div></div>;
}

function AddModal({ user, location, onClose, onSaved }) {
  const [pin, setPin] = useState(location); const [files, setFiles] = useState([]); const [form, setForm] = useState({ title: '', price: '', bedrooms: '', address: '', contact: '', description: '' }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  const save = async e => { e.preventDefault(); if (!pin) return setError('Choose the property location on the map first.'); setSaving(true); setError('');
    try {
      const id = crypto.randomUUID(); const { error: listingError } = await supabase.from('listings').insert({ id, owner_id: user.id, title: form.title.trim(), price: form.price.trim(), bedrooms: form.bedrooms.trim(), address: form.address.trim(), contact: form.contact.trim(), description: form.description.trim(), latitude: pin[0], longitude: pin[1] });
      if (listingError) { setError(listingError.message); setSaving(false); return; }

      const uploadResults = await Promise.allSettled(
        files.map(async (file, index) => {
          const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
          const path = `${user.id}/${id}/${index}.${extension}`;
          const upload = await supabase.storage.from('listing-photos').upload(path, file, { contentType: file.type, upsert: false });
          if (upload.error) throw upload.error;
          const { error: photoError } = await supabase.from('listing_photos').insert({ listing_id: id, storage_path: path });
          if (photoError) throw photoError;
          return path;
        })
      );

      const failed = uploadResults.filter((r) => r.status === 'rejected');
      if (failed.length) {
        setError(`Photo upload failed. Check that the listing-photos bucket and storage policies are configured, then try again. (${failed.length} failed)`);
        setSaving(false);
        return;
      }

      setSaving(false);
      onSaved();
    } catch (err) {
      setError(err?.message || 'Unable to save the listing right now.');
      setSaving(false);
    }
  };
  return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><span className="eyebrow">Share a home</span><h2>New listing</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div><form onSubmit={save} className="listing-form"><div className="location-callout"><MapPin size={18} /><span>{pin ? `Location set: ${pin[0].toFixed(4)}, ${pin[1].toFixed(4)}` : 'Click the map to set the property location'}</span></div><label>Title<input name="title" value={form.title} onChange={update} placeholder="Bright 2BR near the park" required /></label><div className="form-grid"><label>Monthly rent<input name="price" value={form.price} onChange={update} placeholder="€950 or ₹18,000" required /></label><label>Bedrooms<input name="bedrooms" value={form.bedrooms} onChange={update} placeholder="2" /></label></div><label>Address<input name="address" value={form.address} onChange={update} placeholder="Street, area, city" required /></label><label>Contact<input name="contact" value={form.contact} onChange={update} placeholder="Phone or email" required /></label><label>Description<textarea name="description" value={form.description} onChange={update} placeholder="Amenities, availability, nearby transit..." rows="3" /></label><label>Photos<input type="file" accept="image/*" multiple onChange={e => setFiles([...e.target.files].slice(0, 4))} /><span className="file-note"><ImagePlus size={16} /> {files.length ? `${files.length} photo${files.length > 1 ? 's' : ''} selected` : 'Up to 4 photos'}</span></label>{error && <div className="error">{error}</div>}<button className="button primary wide" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={17} /> Publishing...</> : 'Publish listing'}</button></form></div></div>;
}

function App() {
  const [session, setSession] = useState(null); const [profile, setProfile] = useState(null); const [listings, setListings] = useState([]); const [selected, setSelected] = useState(null); const [showFullDetails, setShowFullDetails] = useState(false); const [search, setSearch] = useState(''); const [center, setCenter] = useState(DEFAULT_CENTER); const [mapZoom, setMapZoom] = useState(12); const [liveLocation, setLiveLocation] = useState(null); const [radius, setRadius] = useState(10); const [adding, setAdding] = useState(false); const [pendingPin, setPendingPin] = useState(null); const [loading, setLoading] = useState(true); const [locating, setLocating] = useState(false); const [searching, setSearching] = useState(false); const [installPrompt, setInstallPrompt] = useState(null); const [notice, setNotice] = useState(''); const [path, setPath] = useState(window.location.pathname);
  const load = async user => { const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(); setProfile(p); if (p?.latitude !== null && p?.latitude !== undefined && p?.longitude !== null && p?.longitude !== undefined) { const next = [p.latitude, p.longitude]; setCenter(next); } const { data } = await supabase.from('listings').select('*, listing_photos(storage_path)').order('created_at', { ascending: false });
    const hydrated = await Promise.all((data || []).map(async row => { const photos = await Promise.all((row.listing_photos || []).map(async photo => (await supabase.storage.from('listing-photos').createSignedUrl(photo.storage_path, 3600)).data?.signedUrl)); return { ...row, lat: row.latitude, lng: row.longitude, beds: row.bedrooms, owner: row.owner_id, desc: row.description, photos: photos.filter(Boolean).length ? photos.filter(Boolean) : [fallbackHousePhoto(row.id)] }; })); setListings(hydrated); setLoading(false); };
  useEffect(() => { const onPopState = () => setPath(window.location.pathname); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState); }, []);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { const nextSession = data.session; setSession(nextSession); if (nextSession) { if (window.location.hash.includes('access_token') || new URLSearchParams(window.location.search).has('code')) setNotice('Email confirmed. Welcome to Nestpin.'); if (window.location.pathname !== NESTPIN_PATH) navigate(NESTPIN_PATH); load(nextSession.user); } else { if (window.location.pathname !== HOME_PATH) navigate(HOME_PATH); setLoading(false); } }); const { data: listener } = supabase.auth.onAuthStateChange((event, next) => { setSession(next); if (next) { if (event === 'SIGNED_IN' && (window.location.hash.includes('access_token') || new URLSearchParams(window.location.search).has('code'))) setNotice('Email confirmed. Welcome to Nestpin.'); if (window.location.pathname !== NESTPIN_PATH) navigate(NESTPIN_PATH); load(next.user); } else { if (window.location.pathname !== HOME_PATH) navigate(HOME_PATH); setProfile(null); setLoading(false); } }); return () => listener.subscription.unsubscribe(); }, []);
  useEffect(() => { const captureInstallPrompt = event => { event.preventDefault(); setInstallPrompt(event); }; const installed = () => { setInstallPrompt(null); setNotice('Nestpin was added to your home screen.'); }; window.addEventListener('beforeinstallprompt', captureInstallPrompt); window.addEventListener('appinstalled', installed); return () => { window.removeEventListener('beforeinstallprompt', captureInstallPrompt); window.removeEventListener('appinstalled', installed); }; }, []);
  useEffect(() => { const topbar = document.querySelector('.topbar'); if (!topbar || topbar.querySelector('.install-button')) return undefined; const button = document.createElement('button'); button.className = 'install-button'; button.type = 'button'; button.title = 'Add Nestpin to your home screen'; button.textContent = '+ Add to home'; button.addEventListener('click', installApp); topbar.insertBefore(button, topbar.querySelector('.profile-button')); return () => button.remove(); }, [path, profile, installPrompt]);
  useEffect(() => { if (!navigator.geolocation) return undefined; const watchId = navigator.geolocation.watchPosition(position => setLiveLocation([position.coords.latitude, position.coords.longitude]), undefined, { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }); return () => navigator.geolocation.clearWatch(watchId); }, []);
  const onLocationPick = point => { setPendingPin(point); if (adding) return; if (!profile) setCenter(point); };
  const runSearch = async e => { e.preventDefault(); if (!search.trim() || searching) return; setSearching(true); setNotice('Searching nearby places...'); try { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(search)}`); const data = await res.json(); if (data[0]) { const point = [+data[0].lat, +data[0].lon]; setCenter(point); setMapZoom(14); if (!profile) setPendingPin(point); setNotice('Map centered on your search'); } else setNotice('No matching place found'); } catch { setNotice('Search is unavailable right now'); } finally { setSearching(false); setTimeout(() => setNotice(''), 3000); } };
  const installApp = async () => { if (!installPrompt) { setNotice('Use your browser menu to choose Add to Home Screen.'); setTimeout(() => setNotice(''), 3500); return; } installPrompt.prompt(); const result = await installPrompt.userChoice; if (result.outcome === 'accepted') setNotice('Adding Nestpin to your home screen...'); setInstallPrompt(null); };
  const remove = async item => { if (!confirm('Remove this listing?')) return; setNotice('Removing listing...'); const { data: photos } = await supabase.from('listing_photos').select('storage_path').eq('listing_id', item.id); if (photos?.length) await supabase.storage.from('listing-photos').remove(photos.map(p => p.storage_path)); const { error } = await supabase.from('listings').delete().eq('id', item.id); if (error) { setNotice(error.message); } else { setListings(current => current.filter(l => l.id !== item.id)); setSelected(null); setNotice('Listing removed'); } setTimeout(() => setNotice(''), 3000); };
  const phoneNumber = selected?.contact?.replace(/[^\d+]/g, '') || '';
  useEffect(() => {
    const card = document.querySelector('.detail-card');
    if (!card || !selected) return undefined;
    const content = card.querySelector('.detail-content');
    if (!content || content.querySelector('.contact-actions')) return undefined;
    const actions = document.createElement('div');
    actions.className = 'contact-actions';
    actions.innerHTML = `<a class="button contact-button" href="tel:${phoneNumber}">Call</a><a class="button whatsapp-button" href="https://wa.me/${phoneNumber.replace(/^00/, '')}" target="_blank" rel="noreferrer">WhatsApp</a>`;
    const fullButton = document.createElement('button');
    fullButton.className = 'button primary wide';
    fullButton.textContent = 'View full details';
    fullButton.addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.className = 'full-details-backdrop';
      modal.innerHTML = `<section class="full-details-modal"><button class="icon-button close-detail" type="button">×</button><div class="modal-head"><div><span class="eyebrow">Complete listing</span><h2>${selected.title}</h2></div></div><div class="listing-gallery">${(selected.photos || []).map((photo, index) => `<img src="${photo}" alt="${selected.title} home ${index + 1}">`).join('') || '<div class="gallery-empty">No photos available</div>'}</div><div class="detail-content"><div class="price">${selected.price}<small> / month</small></div><p class="address">${selected.address}</p><p class="meta">${selected.bedrooms || 'Not specified'} bedrooms</p><p class="description">${selected.description || 'No description provided.'}</p><div class="contact">Contact: ${selected.contact}</div></div></section>`;
      modal.querySelector('.close-detail').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', event => event.target === modal && modal.remove());
      document.body.appendChild(modal);
    });
    const contact = content.querySelector('.contact');
    contact?.replaceWith(actions);
    content.insertBefore(fullButton, content.querySelector('.button.danger'));
    return () => { actions.remove(); fullButton.remove(); };
  }, [selected, phoneNumber]);
  const locateUser = () => {
    if (!navigator.geolocation) { setNotice('Location is not supported by this browser'); return; }
    setLocating(true); setNotice('Finding your location...');
    navigator.geolocation.getCurrentPosition(position => {
      const point = [position.coords.latitude, position.coords.longitude];
      setLiveLocation(point); setCenter(point); setMapZoom(16); setLocating(false); setNotice('Centered on your location');
      setTimeout(() => setNotice(''), 2500);
    }, error => {
      setLocating(false); setNotice(error.code === error.PERMISSION_DENIED ? 'Location permission was denied' : 'Location unavailable');
      setTimeout(() => setNotice(''), 3000);
    }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 });
  };
  if (loading) return <div className="loading"><LoaderCircle className="spin" size={28} /> Loading Nestpin</div>;
  if (path !== NESTPIN_PATH || !session) return <AuthPanel onAuthed={(user, name) => { setSession({ user }); setLoading(false); navigate(NESTPIN_PATH); }} onInstall={installApp} canInstall />;
  if (!profile) return <><MapContainer center={center} zoom={3} className="map"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapController center={center} zoom={12} /><MapClick enabled onPick={onLocationPick} />{pendingPin && <Marker position={pendingPin} icon={mineIcon} />}</MapContainer><LocationPanel user={session.user} existing={null} onComplete={p => { setProfile(p); setCenter([p.latitude, p.longitude]); load(session.user); }} />{notice && <div className="toast">{notice}</div>}</>;
  const visible = listings.filter(item => distance(center, [item.lat, item.lng]) <= radius);
  return <div className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark"><House size={17} /></span> nestpin</div><form className="top-search" onSubmit={runSearch}><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a city or region" /><button type="submit">Search</button></form><button className="location-button" title="Center map on my location" aria-label="Center map on my location" onClick={locateUser} disabled={locating}>{locating ? <LoaderCircle className="spin" size={18} /> : <LocateFixed size={18} />}</button><button className="profile-button" title="Sign out" aria-label="Sign out" onClick={async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); navigate(HOME_PATH); }}><span>{profile.display_name?.slice(0, 1).toUpperCase()}</span><LogOut size={14} /></button></header><main className="map-stage"><MapContainer center={center} zoom={12} className="map"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapController center={center} zoom={mapZoom} radius={radius} liveLocation={liveLocation} /><MapClick enabled={adding} onPick={onLocationPick} />{liveLocation && <Marker position={liveLocation} icon={liveIcon} />}{visible.map(item => <Marker key={item.id} position={[item.lat, item.lng]} icon={item.owner === session.user.id ? mineIcon : normalIcon} eventHandlers={{ click: () => setSelected(item), mouseover: event => event.target.openPopup(), mouseout: event => event.target.closePopup() }}><Popup closeButton={false} offset={[0, -34]}><ListingPreview item={item} /></Popup></Marker>)}<Circle center={center} radius={radius * 1000} pathOptions={{ color: '#3f7764', fillOpacity: 0.04 }} />{pendingPin && adding && <Marker position={pendingPin} icon={mineIcon} />}</MapContainer><div className="map-tools"><div className="count"><strong>{visible.length}</strong> places within {radius} km</div><div className="radius-control"><SlidersHorizontal size={15} /><input type="range" min="1" max="200" value={radius} onChange={e => setRadius(+e.target.value)} /><span>{radius} km</span></div></div><button className={`add-button ${adding ? 'cancel' : ''}`} title={adding ? 'Cancel listing' : 'Create a listing'} aria-label={adding ? 'Cancel listing' : 'Create a listing'} onClick={() => { setAdding(!adding); setPendingPin(null); }}>{adding ? <X size={18} /> : <Plus size={18} />}{adding ? 'Cancel' : 'List a place'}</button>{adding && <div className="map-hint">Click anywhere on the map to place your listing</div>}</main>{selected && <div className="detail-card"><button className="icon-button close-detail" title="Close listing details" aria-label="Close listing details" onClick={() => setSelected(null)}><X size={18} /></button>{selected.photos?.[0] && <img src={selected.photos[0]} alt="" />}{!selected.photos?.[0] && <div className="detail-placeholder"><House size={34} /></div>}<div className="detail-content"><span className="eyebrow">Home listing</span><h2>{selected.title}</h2><div className="price">{selected.price}<small> / month</small></div><p className="address"><MapPin size={16} />{selected.address}</p>{selected.bedrooms && <p className="meta">{selected.bedrooms} bedroom{selected.bedrooms === '1' ? '' : 's'}</p>}<p className="description">{selected.description}</p><div className="contact">Contact: {selected.contact}</div>{selected.owner === session.user.id && <button className="button danger wide" onClick={() => remove(selected)}>Remove listing</button>}</div></div>}{notice && <div className="toast">{notice}</div>}{adding && pendingPin && <AddModal user={session.user} location={pendingPin} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setPendingPin(null); load(session.user); setNotice('Listing published'); setTimeout(() => setNotice(''), 3000); }} />}</div>;
}

export default App;
