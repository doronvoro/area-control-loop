import L from 'leaflet';
import type { MonitoringReportForMap } from './types';
import { SEVERITY_CONFIG } from './types';

export function buildSeverityBadge(severity: string | null): string {
  if (!severity) return '';
  const config = SEVERITY_CONFIG[severity];
  if (!config) return '';
  return `<span style="background: ${config.color}; color: white; padding: 1px 6px; border-radius: 9999px; font-size: 10px; font-weight: 600;">${config.label}</span>`;
}

export function buildTreatmentHtml(t: MonitoringReportForMap['treatments'][0]): string {
  const parts: string[] = [];
  if (t.action_type_name) parts.push(t.action_type_name);
  if (t.material_name) parts.push(t.material_name);
  if (t.dosage && t.unit_type_name) parts.push(`${t.dosage} ${t.unit_type_name}`);
  else if (t.dosage) parts.push(`${t.dosage}`);

  const statusIcon = t.status === 'completed' ? '&#10003;' : '&#9202;';
  const statusLabel = t.status === 'completed' ? 'בוצע' : 'ממתין';
  const statusColor = t.status === 'completed' ? '#16a34a' : '#d97706';

  let html = `<div style="padding: 2px 0; font-size: 11px; color: #555;">`;
  if (parts.length > 0) {
    html += `${parts.join(' &middot; ')} `;
  }
  html += `<span style="color: ${statusColor}; font-weight: 500;">${statusIcon} ${statusLabel}</span>`;
  if (t.notes) {
    html += `<div style="color: #888; font-size: 10px; margin-top: 1px;">${t.notes}</div>`;
  }
  html += `</div>`;
  return html;
}

/**
 * Build popup HTML from a name and monitoring reports array.
 * Used by both outdoor map and indoor canvas pin markers.
 */
export function buildMonitoringPopup(name: string, reports: MonitoringReportForMap[]): string {
  let html = `<div style="direction: rtl; min-width: 200px; max-width: 300px;">`;
  html += `<div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${name}</div>`;

  if (reports.length === 0) {
    html += `<div style="color: #888; font-size: 12px;">אין נתוני ניטור</div>`;
  } else {
    reports.forEach((report, i) => {
      if (i > 0) html += `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 6px 0;">`;
      html += `<div style="margin-bottom: 2px;">`;
      html += `<span style="font-weight: 500; font-size: 12px;">${report.finding_name}</span> `;
      html += buildSeverityBadge(report.severity);
      html += `</div>`;

      if (report.treatments.length > 0) {
        report.treatments.forEach((t) => {
          html += buildTreatmentHtml(t);
        });
      }
    });
  }

  html += `</div>`;
  return html;
}

/**
 * Create a Google Maps-style pin icon for monitoring markers.
 */
export function createPinIcon(count: number): L.DivIcon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
    <path d="M15 38C15 38 28 24.5 28 15C28 7.82 22.18 2 15 2C7.82 2 2 7.82 2 15C2 24.5 15 38 15 38Z" fill="#dc2626" stroke="#991b1b" stroke-width="1"/>
    <circle cx="15" cy="15" r="9" fill="white" fill-opacity="0.3"/>
    <text x="15" y="19" text-anchor="middle" fill="white" font-size="12" font-weight="700" font-family="Arial, sans-serif">${count}</text>
  </svg>`;

  return L.divIcon({
    className: 'monitoring-pin-marker',
    html: svg,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
  });
}
