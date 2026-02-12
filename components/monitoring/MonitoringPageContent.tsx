'use client';

import { useState, useEffect } from 'react';
import { MonitoringForm } from './MonitoringForm';
import { ClipboardList } from 'lucide-react';

export function MonitoringPageContent() {
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/monitoring/form-data');

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'שגיאה בטעינת הנתונים');
        }

        const data = await res.json();
        setFormData(data);
      } catch (err: any) {
        setError(err.message || 'שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="monitoring-form-container">
          <div className="monitoring-hero px-6 py-8 md:px-8 md:py-10">
            <div className="hero-pattern" />
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  טופס ניטור חדש
                </h2>
              </div>
              <p className="text-center text-white/70 text-sm">
                מלא את פרטי הניטור עבור השטח הנבחר
              </p>
            </div>
          </div>
          <div className="monitoring-loading">
            <div className="loading-spinner-ring" />
            <span className="text-sm text-muted-foreground font-medium">טוען נתונים...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="monitoring-form-container">
          <div className="monitoring-hero px-6 py-8 md:px-8 md:py-10">
            <div className="hero-pattern" />
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  טופס ניטור חדש
                </h2>
              </div>
            </div>
          </div>
          <div className="p-8 text-center">
            <div className="error-banner inline-flex items-center gap-3 p-4 mx-auto">
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MonitoringForm
      isAdmin={formData.isAdmin}
      customers={formData.customers}
      initialInspectors={formData.initialInspectors}
      initialAreas={formData.initialAreas}
      findings={formData.findings}
      unitTypes={formData.unitTypes}
      customerIdForData={formData.customerIdForData}
    />
  );
}
