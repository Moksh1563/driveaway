import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Search, X, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

const TYPES = ['Hypercar', 'Supercar', 'Sports', 'Luxury', 'SUV', 'Sedan', 'Electric', 'Hatchback'];
const FUELS = ['Petrol', 'Diesel', 'Electric', 'Hybrid'];
const STATUSES = ['Available', 'Rented', 'Maintenance'];
const inputClass = 'w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-400 dark:placeholder-gray-500 shadow-xs transition-all';
const labelClass = 'text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1 block';

const EMPTY_CAR = { name: '', company: '', type: 'Sedan', yearModel: 2024, dailyRate: '', status: 'Available', fuelType: 'Petrol', transmission: 'Manual', seats: 5, luggage: 'Medium', mileage: '', description: '', images: { main: '', img1: '', img2: '', img3: '' } };

export default function AdminCarsPage() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'delete'
  const [currentCar, setCurrentCar] = useState(EMPTY_CAR);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState(null);

  useEffect(() => { fetchCars(); }, []);

  const fetchCars = async () => {
    try {
      const { data } = await api.get('/cars?limit=100');
      setCars(data.cars || []);
    } finally { setLoading(false); }
  };

  const openAdd = () => { setCurrentCar(EMPTY_CAR); setModal('add'); };
  const openEdit = (car) => { setCurrentCar({ ...car, images: { ...EMPTY_CAR.images, ...car.images } }); setModal('edit'); };
  const openDelete = (car) => { setCurrentCar(car); setModal('delete'); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal === 'add') {
        await api.post('/cars', currentCar);
        toast.success('Car added successfully!');
      } else {
        await api.put(`/cars/${currentCar._id}`, currentCar);
        toast.success('Car updated successfully!');
      }
      setModal(null);
      fetchCars();
    } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/cars/${currentCar._id}`);
      toast.success('Car deleted successfully');
      setModal(null);
      fetchCars();
    } catch (err) { toast.error(err.response?.data?.message || 'Cannot delete'); }
  };

  const filtered = cars.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase())
  );

  const setField = (key, val) => setCurrentCar(p => ({ ...p, [key]: val }));
  const setImg = (key, val) => setCurrentCar(p => ({ ...p, images: { ...p.images, [key]: val } }));

  const handleFileUpload = async (slot, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WEBP, GIF, AVIF)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image file must be under 10MB');
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
      toast.success(`Image uploaded for ${slot === 'main' ? 'main photo' : slot.toUpperCase()}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingSlot(null);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 dark:text-white text-2xl sm:text-3xl font-extrabold tracking-tight">Fleet Management</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{cars.length} cars registered in database</p>
        </div>
        <Button icon={Plus} onClick={openAdd} className="font-bold shadow-sm">Add New Car</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by car model or manufacturer..."
          className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl pl-10 pr-4 py-3 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
        />
      </div>

      {loading ? <Spinner /> : (
        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider border-b border-gray-100 dark:border-white/10">
                  <th className="text-left p-4">Car Model</th>
                  <th className="text-left p-4">Body Type</th>
                  <th className="text-left p-4">Daily Rate</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Avg Rating</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filtered.map(car => (
                  <tr key={car._id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={car.images?.main} alt={car.name} className="w-14 h-9 object-cover rounded-lg bg-gray-100 dark:bg-gray-800" onError={e => e.target.style.display = 'none'} />
                        <div>
                          <p className="text-gray-900 dark:text-white font-bold">{car.name}</p>
                          <p className="text-gray-500 text-xs">{car.company} • {car.yearModel}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4"><Badge status={car.type} showDot={false} /></td>
                    <td className="p-4 text-amber-500 font-extrabold text-sm">₹{car.dailyRate.toLocaleString('en-IN')}</td>
                    <td className="p-4"><Badge status={car.status} /></td>
                    <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">{car.averageRating > 0 ? `⭐ ${car.averageRating} (${car.totalReviews})` : '—'}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(car)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openDelete(car)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)} title={modal === 'add' ? 'Add New Vehicle' : 'Edit Vehicle Details'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[['name', 'Car Name (e.g. BMW 3 Series)'], ['company', 'Manufacturer (e.g. BMW)']].map(([key, label]) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input value={currentCar[key] || ''} onChange={e => setField(key, e.target.value)} className={inputClass} />
            </div>
          ))}
          <div>
            <label className={labelClass}>Vehicle Type</label>
            <select value={currentCar.type} onChange={e => setField('type', e.target.value)} className={inputClass}>
              {TYPES.map(t => <option key={t} value={t} className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Availability Status</label>
            <select value={currentCar.status} onChange={e => setField('status', e.target.value)} className={inputClass}>
              {STATUSES.map(s => <option key={s} value={s} className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">{s}</option>)}
            </select>
          </div>
          {[['yearModel', 'Model Year'], ['dailyRate', 'Daily Rental Rate (₹)'], ['seats', 'Seats Capacity'], ['mileage', 'Fuel Efficiency / Mileage']].map(([key, label]) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input type={key === 'mileage' ? 'text' : 'number'} value={currentCar[key] || ''} onChange={e => setField(key, key === 'mileage' ? e.target.value : Number(e.target.value))} className={inputClass} />
            </div>
          ))}
          <div>
            <label className={labelClass}>Fuel Type</label>
            <select value={currentCar.fuelType} onChange={e => setField('fuelType', e.target.value)} className={inputClass}>
              {FUELS.map(f => <option key={f} value={f} className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">{f}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Transmission</label>
            <select value={currentCar.transmission} onChange={e => setField('transmission', e.target.value)} className={inputClass}>
              <option className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">Manual</option>
              <option className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">Automatic</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Description & Features</label>
          <textarea value={currentCar.description || ''} onChange={e => setField('description', e.target.value)} className={`${inputClass} h-20 resize-none`} />
        </div>
        {/* Vehicle Images Section with File Upload Option */}
        <div className="mt-5 space-y-4 pt-4 border-t border-gray-200 dark:border-white/10">
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
              Vehicle Images & Photos
            </label>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Choose an image file from your device (PNG, JPG, WEBP) or paste an image URL.
            </p>
          </div>

          {/* MAIN (Featured) Image */}
          <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-500" /> Main Display Photo (Primary)
              </span>
              {currentCar.images?.main && (
                <button
                  type="button"
                  onClick={() => setImg('main', '')}
                  className="text-[11px] text-red-500 hover:text-red-600 font-bold flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Remove Photo
                </button>
              )}
            </div>

            {currentCar.images?.main ? (
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative w-full sm:w-48 h-32 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-black/5 flex-shrink-0">
                  <img
                    src={currentCar.images.main}
                    alt="Main car preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs transition-colors shadow-xs">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingSlot === 'main' ? 'Uploading...' : 'Replace Image File'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload('main', e)}
                        className="hidden"
                        disabled={uploadingSlot === 'main'}
                      />
                    </label>
                  </div>
                  <input
                    value={currentCar.images.main}
                    onChange={(e) => setImg('main', e.target.value)}
                    className={inputClass}
                    placeholder="Or enter image URL / path"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="border-2 border-dashed border-gray-300 dark:border-white/20 hover:border-amber-500 dark:hover:border-amber-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white/50 dark:bg-black/20 text-center group">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    {uploadingSlot === 'main' ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    {uploadingSlot === 'main' ? 'Uploading Image File...' : 'Click to Upload Main Car Photo'}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Select PNG, JPG, WEBP, AVIF from your device (Max 10MB)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('main', e)}
                    className="hidden"
                    disabled={uploadingSlot === 'main'}
                  />
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 font-bold uppercase whitespace-nowrap">Or URL:</span>
                  <input
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
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block mb-2">
              Additional Gallery Views (Optional)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['img1', 'img2', 'img3'].map((slot, index) => {
                const imgVal = currentCar.images?.[slot] || '';
                return (
                  <div key={slot} className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase">
                        Gallery {index + 1}
                      </span>
                      {imgVal && (
                        <button
                          type="button"
                          onClick={() => setImg(slot, '')}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {imgVal ? (
                      <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-black/5">
                        <img
                          src={imgVal}
                          alt={`Gallery ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    ) : (
                      <label className="w-full h-24 border border-dashed border-gray-300 dark:border-white/20 hover:border-amber-500 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors text-center p-2 group">
                        {uploadingSlot === slot ? (
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 text-gray-400 group-hover:text-amber-500 mb-1" />
                        )}
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
                          {uploadingSlot === slot ? 'Uploading...' : 'Upload File'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(slot, e)}
                          className="hidden"
                          disabled={uploadingSlot === slot}
                        />
                      </label>
                    )}

                    <input
                      value={imgVal}
                      onChange={(e) => setImg(slot, e.target.value)}
                      className="w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-gray-900 dark:text-white text-xs outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="Or enter URL"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="ghost" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1 font-bold">{modal === 'add' ? 'Add Car' : 'Save Changes'}</Button>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={modal === 'delete'} onClose={() => setModal(null)} title="Delete Vehicle" size="sm">
        <p className="text-gray-600 dark:text-gray-400 mb-5 text-sm">
          Are you sure you want to permanently delete <span className="text-gray-900 dark:text-white font-bold">{currentCar?.name}</span>?
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
          <Button variant="danger" onClick={handleDelete} className="flex-1">Yes, Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
