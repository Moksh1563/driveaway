import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Plus, Edit2, Trash2, Search, X, Upload, Image as ImageIcon, Loader2, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import LoadError from '../../components/admin/LoadError';
import { sizedImage, handleImageError } from '../../utils/image';
import { TableSkeleton } from '../../components/ui/Skeletons';
import { EASE, listItem } from '../../theme/motion';
import useDebounced from '../../hooks/useDebounced';
import { ERROR_IN } from '../../components/booking/FieldError';

// Search filters the fleet quietly: the query settles first (debounced), rows that drop out leave at
// once, the rest glide up together a single time, and rows that match again fade in. Only a deleted
// car fades away (AnimatePresence hands each leaving row the deleted id as `custom`). Reduced
// motion: instant.
const ROW_TRANSITION = { layout: { duration: 0.3, ease: EASE.out } };
const DROP_AT_ONCE = { opacity: 0, transition: { duration: 0 } };
const rowExit = (id) => (deletedId) => (deletedId === id ? listItem.exit : DROP_AT_ONCE);
// Skeleton → table: the loaded fleet fades in where the skeleton was (once; searches don't replay it)
const viewIn = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2, ease: EASE.out } } };
// Row icon buttons: border and colour answer hover, the button gives a little under the press
const iconPress = 'transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.96]';

const TYPES = ['Hypercar', 'Supercar', 'Sports', 'Luxury', 'SUV', 'Sedan', 'Electric', 'Hatchback'];
const FUELS = ['Petrol', 'Diesel', 'Electric', 'Hybrid'];
// Admin-controlled status only: whether a car is booked is decided by booking dates
const STATUSES = ['Available', 'Maintenance'];
const CURRENT_YEAR = new Date().getFullYear();
const MAX_UPLOAD_MB = 5;
const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const UPLOAD_EXT = /\.(jpe?g|png|webp|avif|gif)$/i;
const inputClass = 'w-full bg-raised border border-line rounded-xl px-3.5 py-2.5 text-ink text-sm focus:ring-2 focus:ring-ink/30 outline-none placeholder:text-muted/70 transition-[color,background-color,border-color,opacity,box-shadow,transform]';
const labelClass = 'text-xs font-bold text-muted uppercase tracking-wider mb-1 block';
const errorInputClass = 'border-danger focus:ring-danger/30';

// Number fields stay strings while editing, so clearing a field never turns into 0
const EMPTY_CAR = { name: '', company: '', type: 'Sedan', yearModel: String(CURRENT_YEAR), dailyRate: '', status: 'Available', fuelType: 'Petrol', transmission: 'Manual', seats: '5', luggage: 'Medium', mileage: '', description: '', images: { main: '', img1: '', img2: '', img3: '' } };
const PAYLOAD_FIELDS = ['name', 'company', 'type', 'yearModel', 'dailyRate', 'status', 'fuelType', 'transmission', 'seats', 'luggage', 'mileage', 'description', 'images'];

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
/** The status the admin set; an old stored 'Rented' counts as Available (bookings decide that now). */
const adminStatusOf = (car) => car.adminStatus || (car.status === 'Maintenance' ? 'Maintenance' : 'Available');
const asText = (v) => (v === undefined || v === null ? '' : String(v));

const toForm = (car) => ({
  ...EMPTY_CAR,
  ...car,
  status: adminStatusOf(car),
  yearModel: asText(car.yearModel),
  dailyRate: asText(car.dailyRate),
  seats: asText(car.seats),
  mileage: car.mileage || '',
  description: car.description || '',
  images: { ...EMPTY_CAR.images, ...car.images },
});

const toPayload = (form) => {
  const payload = {};
  PAYLOAD_FIELDS.forEach((k) => { payload[k] = form[k]; });
  payload.name = form.name.trim();
  payload.company = form.company.trim();
  payload.dailyRate = Number(form.dailyRate);
  payload.seats = Number(form.seats);
  payload.yearModel = asText(form.yearModel).trim() === '' ? null : Number(form.yearModel);
  return payload;
};

function validateCar(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Enter the car name.';
  if (!form.company.trim()) errors.company = 'Enter the manufacturer.';
  const rate = Number(form.dailyRate);
  if (asText(form.dailyRate).trim() === '' || !Number.isFinite(rate) || rate <= 0) {
    errors.dailyRate = 'Enter a daily rate above ₹0.';
  }
  const seats = Number(form.seats);
  if (asText(form.seats).trim() === '' || !Number.isInteger(seats) || seats < 1 || seats > 20) {
    errors.seats = 'Seats must be a whole number from 1 to 20.';
  }
  if (asText(form.yearModel).trim() !== '') {
    const year = Number(form.yearModel);
    if (!Number.isInteger(year) || year < 1900 || year > CURRENT_YEAR + 1) {
      errors.yearModel = `Model year must be between 1900 and ${CURRENT_YEAR + 1}.`;
    }
  }
  return errors;
}

export default function AdminCarsPage() {
  const [cars, setCars] = useState([]);
  const [totalCars, setTotalCars] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'delete'
  const [currentCar, setCurrentCar] = useState(EMPTY_CAR);
  const [originalCar, setOriginalCar] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [uploadingSlot, setUploadingSlot] = useState(null);
  // The car just deleted (so only its row fades out) and a count of finished row exits (see rowsKey)
  const [deletedId, setDeletedId] = useState(null);
  const [exitsDone, setExitsDone] = useState(0);
  const requestRef = useRef(null);

  const fetchCars = useCallback(async () => {
    // Only the newest request may update the table
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setError('');
    try {
      // The public car list may be cached briefly; the cache-buster makes sure the admin sees each change at once
      const { data } = await api.get('/cars', { params: { limit: 100, _: Date.now() }, signal: controller.signal });
      setCars(data.cars || []);
      setTotalCars(data.totalCars ?? (data.cars || []).length);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err.response?.data?.message || 'Could not load the fleet.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCars();
    return () => requestRef.current?.abort();
  }, [fetchCars]);

  const closeModal = useCallback(() => setModal(null), []);
  const openAdd = () => { setCurrentCar(EMPTY_CAR); setOriginalCar(null); setErrors({}); setModal('add'); };
  const openEdit = (car) => { const form = toForm(car); setCurrentCar(form); setOriginalCar(form); setErrors({}); setModal('edit'); };
  const openDelete = (car) => { setCurrentCar(car); setDeleteError(''); setModal('delete'); };

  const handleSave = async (e) => {
    e?.preventDefault();
    const found = validateCar(currentCar);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error(Object.values(found)[0]);
      return;
    }

    setSaving(true);
    try {
      if (modal === 'add') {
        await api.post('/cars', toPayload(currentCar));
        toast.success('Car added successfully!');
      } else {
        // Send only what changed, so an old copy of the car never overwrites newer values (status included)
        const next = toPayload(currentCar);
        const before = toPayload(originalCar);
        const changes = {};
        PAYLOAD_FIELDS.forEach((k) => {
          if (JSON.stringify(next[k]) !== JSON.stringify(before[k])) changes[k] = next[k];
        });
        if (!Object.keys(changes).length) {
          toast('No changes to save');
          setModal(null);
          return;
        }
        await api.put(`/cars/${currentCar._id}`, changes);
        toast.success('Car updated successfully!');
      }
      setModal(null);
      fetchCars();
    } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/cars/${currentCar._id}`);
      toast.success('Car deleted successfully');
      setDeletedId(currentCar._id);
      setCars(prev => prev.filter(c => c._id !== currentCar._id));
      setModal(null);
      fetchCars();
    } catch (err) { setDeleteError(err.response?.data?.message || 'Cannot delete this car.'); }
    finally { setDeleting(false); }
  };

  const q = useDebounced(search.trim().toLowerCase());
  const filtered = cars.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.company || '').toLowerCase().includes(q)
  );
  // Rows measure their layout only when this changes: the visible rows, or a leaving row finally
  // gone (exitsDone ticks in the same render that removes it, so the rest glide up once)
  const rowsKey = `${filtered.map(c => c._id).join('|')}#${exitsDone}`;

  const setField = (key, val) => {
    setCurrentCar(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: undefined }));
  };
  const setImg = (key, val) => setCurrentCar(p => ({ ...p, images: { ...p.images, [key]: val } }));

  const handleFileUpload = async (slot, e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    if (!UPLOAD_EXT.test(file.name) || (file.type && !UPLOAD_TYPES.includes(file.type))) {
      toast.error('Please choose a JPG, PNG, WEBP, AVIF or GIF image');
      input.value = '';
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`Image file must be under ${MAX_UPLOAD_MB}MB`);
      input.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    setUploadingSlot(slot);
    try {
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImg(slot, data.url);
      toast.success(`Image uploaded for ${slot === 'main' ? 'main photo' : `gallery ${slot.slice(-1)}`}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingSlot(null);
      input.value = '';
    }
  };

  const fieldProps = (key) => ({
    id: `car-${key}`,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `car-${key}-error` : undefined,
  });
  const fieldError = (key) => (errors[key] ? <p key={errors[key]} id={`car-${key}-error`} className={`mt-1 text-xs font-semibold text-danger ${ERROR_IN}`}>{errors[key]}</p> : null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-wide font-black uppercase tracking-tight text-2xl sm:text-3xl">Fleet</h1>
          <p className="text-muted text-sm mt-1">{totalCars} {totalCars === 1 ? 'car' : 'cars'} registered in database</p>
        </div>
        <Button icon={Plus} onClick={openAdd} className="font-bold shadow-sm">Add New Car</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search cars"
          placeholder="Search by car model or manufacturer..."
          className="w-full bg-raised border border-line rounded-chip pl-10 pr-4 py-3 text-ink text-sm outline-none focus:ring-2 focus:ring-ink/30 "
        />
      </div>

      {error && cars.length > 0 && <LoadError message={error} onRetry={fetchCars} />}

      {loading ? <TableSkeleton cols={6} /> : error && cars.length === 0 ? (
        <LoadError message={error} onRetry={() => { setLoading(true); fetchCars(); }} />
      ) : (
        <m.div {...viewIn} className="bg-surface border border-line rounded-chip overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-xs uppercase font-bold tracking-wider border-b border-line">
                  <th scope="col" className="text-left p-4">Car Model</th>
                  <th scope="col" className="text-left p-4">Body Type</th>
                  <th scope="col" className="text-left p-4">Daily Rate</th>
                  <th scope="col" className="text-left p-4">Status</th>
                  <th scope="col" className="text-left p-4">Avg Rating</th>
                  <th scope="col" className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <AnimatePresence initial={false} custom={deletedId} onExitComplete={() => setExitsDone(n => n + 1)}>
                {filtered.map(car => (
                  <m.tr key={car._id} layout="position" layoutDependency={rowsKey} {...listItem} exit={rowExit(car._id)} transition={ROW_TRANSITION} className="hover:bg-ink/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={sizedImage(car.images?.main, 160)} alt="" loading="lazy" decoding="async" onError={(e) => handleImageError(e, 160)} className="w-14 h-9 object-cover rounded-lg bg-ink/5 "/>
                        <div>
                          <p className="text-ink font-bold">{car.name}</p>
                          <p className="text-muted text-xs">{car.company}{car.yearModel ? ` • ${car.yearModel}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4"><Badge status={car.type} showDot={false} /></td>
                    <td className="p-4 text-ink font-extrabold text-sm">₹{Number(car.dailyRate || 0).toLocaleString('en-IN')}</td>
                    <td className="p-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <Badge status={adminStatusOf(car)} />
                        {car.bookedNow && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-2.5 py-1 code-label text-[11px] text-ink">
                            <span className="w-1.5 h-1.5 rounded-full bg-ink" aria-hidden="true" />
                            Booked now{car.nextFreeDate ? ` · free ${fmtDate(car.nextFreeDate)}` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-muted font-medium">{car.averageRating > 0 ? <span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current text-ink" aria-hidden="true" />{car.averageRating} ({car.totalReviews})</span> : '—'}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(car)}
                          aria-label={`Edit ${car.name}`}
                          title="Edit car"
                          className={`hit-area w-8 h-8 flex items-center justify-center rounded-lg border border-line text-ink hover:border-ink ${iconPress}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDelete(car)}
                          aria-label={`Delete ${car.name}`}
                          title="Delete car"
                          className={`hit-area w-8 h-8 flex items-center justify-center rounded-lg border border-line text-danger hover:border-danger hover:bg-danger/10 ${iconPress}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </m.tr>
                ))}
                </AnimatePresence>
                {filtered.length === 0 && (
                  <m.tr initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE.out } }}>
                    <td colSpan={6} className="p-8 text-center text-muted">{cars.length ? 'No cars match this search' : 'No cars yet. Add the first one.'}</td>
                  </m.tr>
                )}
              </tbody>
            </table>
          </div>
        </m.div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modal === 'add' || modal === 'edit'} onClose={closeModal} title={modal === 'add' ? 'Add New Vehicle' : 'Edit Vehicle Details'} size="lg">
        <form onSubmit={handleSave} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[['name', 'Car Name (e.g. BMW 3 Series)'], ['company', 'Manufacturer (e.g. BMW)']].map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`car-${key}`} className={labelClass}>{label}</label>
                <input
                  {...fieldProps(key)}
                  required
                  value={currentCar[key] || ''}
                  onChange={e => setField(key, e.target.value)}
                  className={`${inputClass} ${errors[key] ? errorInputClass : ''}`}
                />
                {fieldError(key)}
              </div>
            ))}
            <div>
              <label htmlFor="car-type" className={labelClass}>Vehicle Type</label>
              <select id="car-type" value={currentCar.type} onChange={e => setField('type', e.target.value)} className={inputClass}>
                {TYPES.map(t => <option key={t} value={t} className="bg-surface text-ink">{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="car-status" className={labelClass}>Availability Status</label>
              <select id="car-status" aria-describedby="car-status-hint" value={currentCar.status} onChange={e => setField('status', e.target.value)} className={inputClass}>
                {STATUSES.map(s => <option key={s} value={s} className="bg-surface text-ink">{s}</option>)}
              </select>
              <p id="car-status-hint" className="mt-1 text-[11px] text-muted">
                Maintenance stops new bookings. Otherwise booking dates decide when the car is free
                {modal === 'edit' && currentCar.bookedNow ? `; it is booked now${currentCar.nextFreeDate ? ` until ${fmtDate(currentCar.nextFreeDate)}` : ''}.` : '.'}
              </p>
            </div>
            {[
              ['yearModel', 'Model Year', { min: 1900, max: CURRENT_YEAR + 1, step: 1 }],
              ['dailyRate', 'Daily Rental Rate (₹)', { min: 1, step: 1, required: true }],
              ['seats', 'Seats Capacity', { min: 1, max: 20, step: 1, required: true }],
            ].map(([key, label, attrs]) => (
              <div key={key}>
                <label htmlFor={`car-${key}`} className={labelClass}>{label}</label>
                <input
                  {...fieldProps(key)}
                  {...attrs}
                  type="number"
                  inputMode="numeric"
                  value={currentCar[key] ?? ''}
                  onChange={e => setField(key, e.target.value)}
                  className={`${inputClass} ${errors[key] ? errorInputClass : ''}`}
                />
                {fieldError(key)}
              </div>
            ))}
            <div>
              <label htmlFor="car-mileage" className={labelClass}>Fuel Efficiency / Mileage</label>
              <input id="car-mileage" type="text" value={currentCar.mileage || ''} onChange={e => setField('mileage', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="car-fuelType" className={labelClass}>Fuel Type</label>
              <select id="car-fuelType" value={currentCar.fuelType} onChange={e => setField('fuelType', e.target.value)} className={inputClass}>
                {FUELS.map(f => <option key={f} value={f} className="bg-surface text-ink">{f}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="car-transmission" className={labelClass}>Transmission</label>
              <select id="car-transmission" value={currentCar.transmission} onChange={e => setField('transmission', e.target.value)} className={inputClass}>
                <option className="bg-surface text-ink">Manual</option>
                <option className="bg-surface text-ink">Automatic</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="car-description" className={labelClass}>Description & Features</label>
            <textarea id="car-description" value={currentCar.description || ''} onChange={e => setField('description', e.target.value)} className={`${inputClass} h-20 resize-none`} />
          </div>
          {/* Vehicle Images Section with File Upload Option */}
          <div className="mt-5 space-y-4 pt-4 border-t border-line">
            <div>
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                Vehicle Images & Photos
              </h3>
              <p className="text-[11px] text-muted mt-0.5">
                Choose an image file from your device (JPG, PNG, WEBP, AVIF or GIF, up to {MAX_UPLOAD_MB}MB) or paste an image URL.
              </p>
            </div>

            {/* MAIN (Featured) Image */}
            <div className="bg-raised border border-line rounded-chip p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-ink" aria-hidden="true" /> Main Display Photo (Primary)
                </span>
                {currentCar.images?.main && (
                  <button
                    type="button"
                    onClick={() => setImg('main', '')}
                    className="text-[11px] text-danger hover:underline font-bold flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" /> Remove Photo
                  </button>
                )}
              </div>

              {currentCar.images?.main ? (
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="relative w-full sm:w-48 h-32 rounded-xl overflow-hidden border border-line bg-black/5 flex-shrink-0">
                    <img
                      key={currentCar.images.main}
                      src={currentCar.images.main}
                      alt="Main car preview"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <div className="flex items-center gap-2">
                      {/* The file input stays focusable (sr-only, not display:none) so keyboards can reach it */}
                      <label className="relative cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-ink hover:bg-ink/85 text-ground font-bold rounded-xl text-xs transition-colors focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2 focus-within:ring-offset-surface">
                        <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                        {uploadingSlot === 'main' ? 'Uploading...' : 'Replace Image File'}
                        <input
                          type="file"
                          accept={UPLOAD_TYPES.join(',')}
                          onChange={(e) => handleFileUpload('main', e)}
                          className="sr-only"
                          disabled={uploadingSlot === 'main'}
                        />
                      </label>
                    </div>
                    <input
                      aria-label="Main photo URL"
                      value={currentCar.images.main}
                      onChange={(e) => setImg('main', e.target.value)}
                      className={inputClass}
                      placeholder="Or enter image URL / path"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="relative border-2 border-dashed border-line hover:border-ink rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-surface text-center group focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/30">
                    <div className="w-12 h-12 rounded-full bg-ink/10 text-ink flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      {uploadingSlot === 'main' ? (
                        <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                      ) : (
                        <Upload className="w-6 h-6" aria-hidden="true" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-ink">
                      {uploadingSlot === 'main' ? 'Uploading Image File...' : 'Upload Main Car Photo'}
                    </span>
                    <span className="text-[11px] text-muted mt-0.5">
                      Select JPG, PNG, WEBP, AVIF or GIF from your device (Max {MAX_UPLOAD_MB}MB)
                    </span>
                    <input
                      type="file"
                      accept={UPLOAD_TYPES.join(',')}
                      onChange={(e) => handleFileUpload('main', e)}
                      className="sr-only"
                      disabled={uploadingSlot === 'main'}
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <label htmlFor="car-img-main-url" className="text-[11px] text-muted font-bold uppercase whitespace-nowrap">Or URL:</label>
                    <input
                      id="car-img-main-url"
                      value={currentCar.images?.main || ''}
                      onChange={(e) => setImg('main', e.target.value)}
                      className={inputClass}
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ADDITIONAL GALLERY ANGLES */}
            <div>
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                Additional Gallery Views (Optional)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['img1', 'img2', 'img3'].map((slot, index) => {
                  const imgVal = currentCar.images?.[slot] || '';
                  return (
                    <div key={slot} className="bg-raised border border-line rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-muted uppercase">
                          Gallery {index + 1}
                        </span>
                        {imgVal && (
                          <button
                            type="button"
                            onClick={() => setImg(slot, '')}
                            aria-label={`Remove gallery photo ${index + 1}`}
                            className="hit-area text-muted hover:text-danger"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {imgVal ? (
                        <div className="relative w-full h-24 rounded-lg overflow-hidden border border-line bg-black/5">
                          <img
                            key={imgVal}
                            src={imgVal}
                            alt={`Gallery ${index + 1} preview`}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                      ) : (
                        <label className="relative w-full h-24 border border-dashed border-line hover:border-ink rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors text-center p-2 group focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/30">
                          {uploadingSlot === slot ? (
                            <Loader2 className="w-4 h-4 text-ink animate-spin" aria-hidden="true" />
                          ) : (
                            <Upload className="w-4 h-4 text-muted group-hover:text-ink mb-1" aria-hidden="true" />
                          )}
                          <span className="text-[11px] font-bold text-muted">
                            {uploadingSlot === slot ? 'Uploading...' : 'Upload File'}
                          </span>
                          <input
                            type="file"
                            accept={UPLOAD_TYPES.join(',')}
                            aria-label={`Upload gallery photo ${index + 1}`}
                            onChange={(e) => handleFileUpload(slot, e)}
                            className="sr-only"
                            disabled={uploadingSlot === slot}
                          />
                        </label>
                      )}

                      <input
                        aria-label={`Gallery photo ${index + 1} URL`}
                        value={imgVal}
                        onChange={(e) => setImg(slot, e.target.value)}
                        className="w-full bg-raised border border-line rounded-lg px-2.5 py-1.5 text-ink text-xs outline-none focus:ring-1 focus:ring-ink/30"
                        placeholder="Or enter URL"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="ghost" onClick={closeModal} className="flex-1">Cancel</Button>
            <Button type="submit" loading={saving} disabled={!!uploadingSlot} className="flex-1 font-bold">{modal === 'add' ? 'Add Car' : 'Save Changes'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <ConfirmDialog
        isOpen={modal === 'delete'}
        onClose={closeModal}
        onConfirm={handleDelete}
        title="Delete Vehicle"
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        danger
        loading={deleting}
        error={deleteError}
      >
        <p className="text-muted">
          Are you sure you want to permanently delete <span className="text-ink font-bold">{currentCar?.name}</span>?
          A car with pending or confirmed bookings cannot be deleted.
        </p>
      </ConfirmDialog>
    </div>
  );
}
