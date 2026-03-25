/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Printer, Search, UserPlus, ArrowLeft } from 'lucide-react';
import { supabase } from './lib/supabase';

interface Patient {
  id: string;
  name: string;
  dob: string;
  address_phone: string;
}

interface Record {
  id: string;
  patient_id: string;
  date: string;
  sys: string;
  dia: string;
  hr: string;
  complaint: string;
  therapy: string;
}

function calculateAge(dob: string) {
  if (!dob) return '';
  let birthDate: Date;
  
  if (dob.includes('/')) {
    const [day, month, year] = dob.split('/').map(Number);
    birthDate = new Date(year, month - 1, day);
  } else {
    birthDate = new Date(dob);
  }
  
  if (isNaN(birthDate.getTime())) return '';
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function formatDate(dateString: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear().toString().slice(-2);
  return `${day}/${month} '${year}`;
}

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const [newPatient, setNewPatient] = useState({ 
    name: '', 
    dob: '', 
    address_phone: '',
    sys: '',
    dia: '',
    hr: '',
    complaint: '',
    therapy: ''
  });
  const [dobError, setDobError] = useState('');
  const [bpError, setBpError] = useState('');
  const [recordBpError, setRecordBpError] = useState('');

  const [records, setRecords] = useState<Record[]>([]);
  const [newRecord, setNewRecord] = useState<Partial<Record>>({
    date: new Date().toISOString().split('T')[0],
    sys: '', dia: '', hr: '', complaint: '', therapy: ''
  });

  // Fetch patients for search
  useEffect(() => {
    if (!supabase) return;
    
    const fetchPatients = async () => {
      let query = supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(20);
      
      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      if (data) setPatients(data);
    };
    
    const timeoutId = setTimeout(() => {
      fetchPatients();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Fetch records when patient selected
  useEffect(() => {
    if (!supabase || !selectedPatient) return;
    
    setRecordBpError(''); // Reset BP error when switching patient
    const fetchRecords = async () => {
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('patient_id', selectedPatient.id)
        .order('date', { ascending: true });
        
      if (data) setRecords(data);
    };
    
    fetchRecords();
  }, [selectedPatient]);

  const validateDOB = (dob: string) => {
    if (!dob) return true; // Allow empty if not required, but here it is required in form
    const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
    if (!regex.test(dob)) return false;
    
    const [day, month, year] = dob.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };

  const validateBP = (sys: string, dia: string) => {
    if (!sys && !dia) return { valid: true, message: '' };
    
    const s = parseInt(sys);
    const d = parseInt(dia);

    if (sys && (isNaN(s) || s < 100 || s > 140)) {
      return { valid: false, message: 'Sistolik harus angka antara 100-140' };
    }
    if (dia && (isNaN(d) || d < 70 || d > 90)) {
      return { valid: false, message: 'Diastolik harus angka antara 70-90' };
    }
    
    return { valid: true, message: '' };
  };

  const parseDOB = (dob: string) => {
    if (!dob) return '';
    const [day, month, year] = dob.split('/');
    return `${year}-${month}-${day}`;
  };

  const formatDOBForDisplay = (isoDate: string) => {
    if (!isoDate) return '';
    // Handle YYYY-MM-DD format from database
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    if (!validateDOB(newPatient.dob)) {
      setDobError('Format tanggal lahir harus DD/MM/YYYY (contoh: 25/12/1990)');
      return;
    }
    setDobError('');

    const bpValidation = validateBP(newPatient.sys, newPatient.dia);
    if (!bpValidation.valid) {
      setBpError(bpValidation.message);
      return;
    }
    setBpError('');
    
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .insert([{
        name: newPatient.name,
        dob: parseDOB(newPatient.dob),
        address_phone: newPatient.address_phone
      }])
      .select()
      .single();
      
    if (patientData) {
      // Insert initial record if any medical info provided
      if (newPatient.sys || newPatient.dia || newPatient.hr || newPatient.complaint || newPatient.therapy) {
        const { error: recordError } = await supabase
          .from('records')
          .insert([{
            patient_id: patientData.id,
            date: new Date().toISOString().split('T')[0],
            sys: newPatient.sys,
            dia: newPatient.dia,
            hr: newPatient.hr,
            complaint: newPatient.complaint,
            therapy: newPatient.therapy
          }]);
          
        if (recordError) {
          console.error("Error creating initial record:", recordError);
        }
      }

      setSelectedPatient(patientData);
      setIsCreating(false);
      setNewPatient({ 
        name: '', dob: '', address_phone: '',
        sys: '', dia: '', hr: '', complaint: '', therapy: ''
      });
      setSearchQuery('');
      setBpError('');
    } else if (patientError) {
      console.error("Error creating patient:", patientError);
      alert("Gagal membuat pasien baru.");
    }
  };

  const handleUpdatePatient = async (field: keyof Patient, value: string) => {
    if (!selectedPatient || !supabase) return;
    
    const { error } = await supabase
      .from('patients')
      .update({ [field]: value })
      .eq('id', selectedPatient.id);
      
    if (error) {
      console.error("Error updating patient:", error);
    }
  };

  const handleAddRecord = async () => {
    if (!newRecord.date || !selectedPatient || !supabase) return;
    
    const bpValidation = validateBP(newRecord.sys || '', newRecord.dia || '');
    if (!bpValidation.valid) {
      setRecordBpError(bpValidation.message);
      return;
    }
    setRecordBpError('');

    const recordData = {
      patient_id: selectedPatient.id,
      date: newRecord.date,
      sys: newRecord.sys || '',
      dia: newRecord.dia || '',
      hr: newRecord.hr || '',
      complaint: newRecord.complaint || '',
      therapy: newRecord.therapy || ''
    };

    const { data, error } = await supabase
      .from('records')
      .insert([recordData])
      .select()
      .single();

    if (data) {
      setRecords([...records, data]);
      setNewRecord({
        date: new Date().toISOString().split('T')[0],
        sys: '', dia: '', hr: '', complaint: '', therapy: ''
      });
      setRecordBpError('');
    } else if (error) {
      console.error("Error adding record:", error);
      alert("Gagal menyimpan rekam medis.");
    }
  };

  const deleteRecord = async (id: string) => {
    if (!supabase) return;
    if (confirm('Hapus rekam medis ini?')) {
      const { error } = await supabase.from('records').delete().eq('id', id);
      if (!error) {
        setRecords(records.filter(r => r.id !== id));
      } else {
        console.error("Error deleting record:", error);
        alert("Gagal menghapus rekam medis.");
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!supabase) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-lg w-full text-center border-t-4 border-red-500">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Supabase Belum Dikonfigurasi</h2>
          <p className="text-gray-700 mb-6">
            Aplikasi ini membutuhkan database Supabase untuk menyimpan data pasien.
          </p>
          <div className="text-left bg-gray-50 p-4 rounded-lg text-sm text-gray-800 space-y-2 font-mono">
            <p>1. Buat project di <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">Supabase</a></p>
            <p>2. Jalankan SQL berikut di SQL Editor:</p>
            <pre className="bg-gray-800 text-green-400 p-3 rounded overflow-x-auto text-xs mt-2">
{`-- Hapus tabel lama jika ada (PERINGATAN: Menghapus semua data!)
drop table if exists records;
drop table if exists patients;

create table patients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  dob date,
  address_phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table records (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references patients(id) on delete cascade not null,
  date date not null,
  sys text,
  dia text,
  hr text,
  complaint text,
  therapy text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);`}
            </pre>
            <p className="mt-4">3. Tambahkan di AI Studio Settings (Secrets):</p>
            <ul className="list-disc pl-5 mt-1">
              <li>VITE_SUPABASE_URL</li>
              <li>VITE_SUPABASE_ANON_KEY</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // --- SEARCH VIEW ---
  if (!selectedPatient) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans text-gray-900">
        <div className="max-w-3xl mx-auto mt-4 md:mt-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-green-800 tracking-tight">CLASSIC THERAPY</h1>
            <h2 className="text-xl font-bold text-green-700 tracking-widest mt-1">SISTEM REKAM MEDIS</h2>
          </div>
          
          {isCreating ? (
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
                <UserPlus size={24} /> Tambah Pasien Baru
              </h3>
              <form onSubmit={handleCreatePatient} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nama Lengkap</label>
                    <input required type="text" value={newPatient.name} onChange={e => setNewPatient({...newPatient, name: e.target.value})} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Masukkan nama pasien" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Tanggal Lahir (DD/MM/YYYY)</label>
                    <input 
                      required 
                      type="text" 
                      value={newPatient.dob} 
                      onChange={e => {
                        setNewPatient({...newPatient, dob: e.target.value});
                        if (dobError) setDobError('');
                      }} 
                      className={`w-full border ${dobError ? 'border-red-500' : 'border-gray-300'} rounded-md p-3 focus:ring-2 focus:ring-green-500 outline-none`} 
                      placeholder="Contoh: 25/12/1990"
                    />
                    {dobError && <p className="text-red-500 text-xs mt-1 font-bold">{dobError}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Alamat / Telp.</label>
                  <input type="text" value={newPatient.address_phone} onChange={e => setNewPatient({...newPatient, address_phone: e.target.value})} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Masukkan alamat dan nomor telepon" />
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <h4 className="text-md font-bold text-green-700 mb-4">Data Pemeriksaan Awal (Opsional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Sistolik</label>
                        <input 
                          type="text" 
                          placeholder="120" 
                          value={newPatient.sys} 
                          onChange={e => {
                            setNewPatient({...newPatient, sys: e.target.value});
                            if (bpError) setBpError('');
                          }} 
                          className={`w-full border ${bpError && bpError.includes('Sistolik') ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 focus:ring-2 focus:ring-green-500 outline-none text-center`} 
                        />
                      </div>
                      <div className="flex items-end pb-2 text-xl font-light">/</div>
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Diastolik</label>
                        <input 
                          type="text" 
                          placeholder="80" 
                          value={newPatient.dia} 
                          onChange={e => {
                            setNewPatient({...newPatient, dia: e.target.value});
                            if (bpError) setBpError('');
                          }} 
                          className={`w-full border ${bpError && bpError.includes('Diastolik') ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 focus:ring-2 focus:ring-green-500 outline-none text-center`} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nadi</label>
                      <input type="text" placeholder="80" value={newPatient.hr} onChange={e => setNewPatient({...newPatient, hr: e.target.value})} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-green-500 outline-none text-center" />
                    </div>
                  </div>
                  {bpError && <p className="text-red-500 text-xs mb-4 font-bold">{bpError}</p>}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Keluhan</label>
                      <textarea rows={2} value={newPatient.complaint} onChange={e => setNewPatient({...newPatient, complaint: e.target.value})} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-green-500 outline-none resize-none" placeholder="Masukkan keluhan pasien..."></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Titik Akupunktur (Therapy)</label>
                      <textarea rows={2} value={newPatient.therapy} onChange={e => setNewPatient({...newPatient, therapy: e.target.value})} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-green-500 outline-none resize-none" placeholder="Masukkan titik akupunktur / terapi..."></textarea>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 bg-green-700 hover:bg-green-800 text-white px-4 py-3 rounded-lg font-bold transition-colors">
                    Simpan Pasien & Rekam Medis
                  </button>
                  <button type="button" onClick={() => setIsCreating(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-bold transition-colors">
                    Batal
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-200">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                  <input 
                    type="text" 
                    placeholder="Cari nama pasien..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-lg"
                  />
                </div>
                <button onClick={() => {
                  setIsCreating(true);
                  setBpError(''); // Reset BP error when opening form
                }} className="bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors whitespace-nowrap">
                  <UserPlus size={20} /> Pasien Baru
                </button>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {patients.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    {searchQuery ? 'Pasien tidak ditemukan.' : 'Belum ada data pasien.'}
                  </div>
                ) : (
                  patients.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => setSelectedPatient(p)} 
                      className="p-4 border border-gray-200 rounded-xl hover:bg-green-50 hover:border-green-300 cursor-pointer flex justify-between items-center transition-all"
                    >
                      <div>
                        <p className="font-bold text-lg text-gray-900">{p.name}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {p.dob ? `${calculateAge(p.dob)} tahun` : 'Umur tidak diketahui'} • {p.address_phone || 'Alamat/Telp tidak ada'}
                        </p>
                      </div>
                      <div className="text-green-600 bg-green-100 p-2 rounded-full">
                        <ArrowLeft size={20} className="rotate-180" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- PATIENT RECORD VIEW ---
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans text-gray-900 print-p-0 print-bg-transparent">
      <div className="max-w-5xl mx-auto">
        
        {/* Action Bar */}
        <div className="flex justify-between mb-4 no-print gap-2">
          <button 
            onClick={() => setSelectedPatient(null)}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md flex items-center gap-2 shadow-sm transition-colors"
          >
            <ArrowLeft size={18} /> Kembali
          </button>
          <button 
            onClick={handlePrint}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md flex items-center gap-2 shadow-sm transition-colors"
          >
            <Printer size={18} /> Cetak / PDF
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white shadow-xl print-shadow-none rounded-xl print:rounded-none overflow-hidden border border-gray-200 print:border-none">
          
          {/* Header & Patient Info */}
          <div className="p-6 md:p-10 border-b-2 border-green-800 print-border-black">
            <div className="flex flex-col md:flex-row justify-between items-start gap-8">
              {/* Left Side */}
              <div className="flex-1 space-y-8 w-full">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-green-800 print-text-black tracking-tight">CLASSIC THERAPY</h1>
                  <h2 className="text-xl md:text-2xl font-bold text-green-700 print-text-black tracking-widest mt-1">AKUPUNKTUR</h2>
                </div>
                <div className="flex items-end gap-2 text-lg w-full max-w-lg">
                  <span className="font-semibold text-green-900 print-text-black whitespace-nowrap">Alamat / Telp. :</span>
                  <input 
                    type="text" 
                    value={selectedPatient.address_phone} 
                    onChange={e => setSelectedPatient({...selectedPatient, address_phone: e.target.value})} 
                    onBlur={e => handleUpdatePatient('address_phone', e.target.value)}
                    className="flex-1 border-b border-black outline-none px-2 py-1 bg-transparent no-print w-full" 
                    placeholder="Masukkan alamat dan telepon"
                  />
                  <span className="hidden print-only border-b border-black flex-1 px-2 py-1">{selectedPatient.address_phone}</span>
                </div>
              </div>

              {/* Right Side */}
              <div className="w-full md:w-1/3 space-y-4 text-lg">
                <div className="flex items-end gap-2">
                  <span className="font-semibold text-green-900 print-text-black w-28">Nama :</span>
                  <input 
                    type="text" 
                    value={selectedPatient.name} 
                    onChange={e => setSelectedPatient({...selectedPatient, name: e.target.value})} 
                    onBlur={e => handleUpdatePatient('name', e.target.value)}
                    className="flex-1 border-b border-black outline-none px-2 py-1 bg-transparent no-print w-full" 
                    placeholder="Nama Pasien"
                  />
                  <span className="hidden print-only border-b border-black flex-1 px-2 py-1">{selectedPatient.name}</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="font-semibold text-green-900 print-text-black w-28">Tgl Lahir :</span>
                  <div className="flex-1 flex flex-col no-print">
                    <input 
                      type="text" 
                      value={formatDOBForDisplay(selectedPatient.dob)} 
                      onChange={e => {
                        const val = e.target.value;
                        setSelectedPatient({...selectedPatient, dob: val});
                      }} 
                      onBlur={e => {
                        const val = e.target.value;
                        if (validateDOB(val)) {
                          handleUpdatePatient('dob', parseDOB(val));
                        } else if (val !== '') {
                          alert('Format tanggal lahir salah! Gunakan DD/MM/YYYY');
                          // Revert to original if invalid? Or just let them fix it.
                          // For simplicity, we just alert.
                        }
                      }}
                      className="border-b border-black outline-none px-2 py-1 bg-transparent w-full text-base" 
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                  <span className="hidden print-only border-b border-black flex-1 px-2 py-1">
                    {selectedPatient.dob ? (validateDOB(selectedPatient.dob) ? selectedPatient.dob : formatDOBForDisplay(selectedPatient.dob)) : ''}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="font-semibold text-green-900 print-text-black w-28">Umur :</span>
                  <div className="flex-1 border-b border-black px-2 py-1 text-gray-800 print-text-black font-medium">
                    {calculateAge(selectedPatient.dob)} {selectedPatient.dob ? 'tahun' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Add Record Form (No Print) */}
          <div className="p-6 md:p-10 bg-green-50/50 border-b border-gray-200 no-print">
            <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">
              <Plus size={20} /> Tambah Rekam Medis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">Tanggal</label>
                <input type="date" value={newRecord.date} onChange={e => setNewRecord({...newRecord, date: e.target.value})} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white" />
              </div>
              <div className="md:col-span-3 flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Sistolik</label>
                  <input 
                    type="text" 
                    placeholder="132" 
                    value={newRecord.sys} 
                    onChange={e => {
                      setNewRecord({...newRecord, sys: e.target.value});
                      if (recordBpError) setRecordBpError('');
                    }} 
                    className={`w-full border ${recordBpError && recordBpError.includes('Sistolik') ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-center`} 
                  />
                </div>
                <div className="flex items-end pb-2 text-xl font-light">/</div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Diastolik</label>
                  <input 
                    type="text" 
                    placeholder="93" 
                    value={newRecord.dia} 
                    onChange={e => {
                      setNewRecord({...newRecord, dia: e.target.value});
                      if (recordBpError) setRecordBpError('');
                    }} 
                    className={`w-full border ${recordBpError && recordBpError.includes('Diastolik') ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-center`} 
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nadi</label>
                  <input type="text" placeholder="96" value={newRecord.hr} onChange={e => setNewRecord({...newRecord, hr: e.target.value})} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-center" />
                </div>
              </div>
              <div className="md:col-span-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Keluhan</label>
                <textarea rows={2} value={newRecord.complaint} onChange={e => setNewRecord({...newRecord, complaint: e.target.value})} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none bg-white" placeholder="- Lutut kiri dpn/blkg skt..."></textarea>
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">Therapy</label>
                <textarea rows={2} value={newRecord.therapy} onChange={e => setNewRecord({...newRecord, therapy: e.target.value})} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none bg-white" placeholder="- BD (B+Db)..."></textarea>
              </div>
            </div>
            {recordBpError && <p className="text-red-500 text-xs mt-2 font-bold">{recordBpError}</p>}
            <div className="mt-4 flex justify-end">
              <button onClick={handleAddRecord} className="bg-green-700 hover:bg-green-800 text-white px-6 py-2 rounded-md flex items-center gap-2 transition-colors font-medium shadow-sm">
                <Save size={18} /> Simpan
              </button>
            </div>
          </div>

          {/* Records Table */}
          <div className="p-6 md:p-10">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-green-800 print-border-black min-w-[800px]">
                <thead>
                  <tr className="bg-green-100 print-bg-transparent">
                    <th className="border-2 border-green-800 print-border-black p-3 text-center w-28 font-bold text-green-900 print-text-black text-lg">TGL.</th>
                    <th className="border-2 border-green-800 print-border-black p-3 text-center w-36 font-bold text-green-900 print-text-black text-lg">TENSI</th>
                    <th className="border-2 border-green-800 print-border-black p-3 text-center font-bold text-green-900 print-text-black text-lg">KELUHAN</th>
                    <th className="border-2 border-green-800 print-border-black p-3 text-center w-1/3 font-bold text-green-900 print-text-black text-lg">THERAPY</th>
                    <th className="border-2 border-green-800 print-border-black p-3 text-center w-16 font-bold text-green-900 print-text-black no-print">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => (
                    <tr key={record.id} className="hover:bg-green-50 print:hover:bg-transparent transition-colors">
                      <td className="border-2 border-green-800 print-border-black p-3 align-top text-center font-medium text-lg">
                        {formatDate(record.date)}
                      </td>
                      <td className="border-2 border-green-800 print-border-black p-3 align-top text-center">
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex flex-col items-center">
                            <span className="border-b-2 border-green-800 print-border-black px-2 leading-tight font-bold text-xl">{record.sys || '-'}</span>
                            <span className="px-2 leading-tight font-bold text-xl">{record.dia || '-'}</span>
                          </div>
                          <span className="font-bold text-xl">{record.hr || '-'}</span>
                        </div>
                      </td>
                      <td className="border-2 border-green-800 print-border-black p-3 align-top whitespace-pre-wrap text-xl font-medium">
                        {record.complaint}
                      </td>
                      <td className="border-2 border-green-800 print-border-black p-3 align-top whitespace-pre-wrap text-xl font-medium">
                        {record.therapy}
                      </td>
                      <td className="border-2 border-green-800 print-border-black p-3 align-top text-center no-print">
                        <button onClick={() => deleteRecord(record.id)} className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 transition-colors" title="Hapus">
                          <Trash2 size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Empty rows for visual similarity to paper form */}
                  {Array.from({ length: Math.max(0, 15 - records.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="h-16">
                      <td className="border-2 border-green-800 print-border-black p-3"></td>
                      <td className="border-2 border-green-800 print-border-black p-3"></td>
                      <td className="border-2 border-green-800 print-border-black p-3"></td>
                      <td className="border-2 border-green-800 print-border-black p-3"></td>
                      <td className="border-2 border-green-800 print-border-black p-3 no-print"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
