import React from 'react';

export const AVAILABLE_FIELDS = [
  { key: 'card_name', label: 'Title / Card Name', default: true },
  { key: 'set_name', label: 'Edition / Set Name', default: true },
  { key: 'reg_quantity', label: 'Regular Quantity', default: true },
  { key: 'foil_quantity', label: 'Foil Quantity', default: true },
  { key: 'scryfall_id', label: 'Scryfall ID', default: false },
  { key: 'mana_cost', label: 'Mana Cost', default: false },
  { key: 'type_line', label: 'Type Line', default: false },
  { key: 'oracle_text', label: 'Oracle Text', default: false },
  { key: 'rarity', label: 'Rarity', default: false },
  { key: 'cmc', label: 'CMC', default: false },
  { key: 'colors', label: 'Colors', default: false },
  { key: 'price_usd', label: 'Price (USD)', default: false },
  { key: 'price_usd_foil', label: 'Price Foil (USD)', default: false },
  { key: 'tags', label: 'Tags', default: false },
];

export default function ExportModal({
  showExportModal,
  setShowExportModal,
  exportFormat,
  setExportFormat,
  selectedFields,
  setSelectedFields,
  exporting,
  exportProgress,
  handleExecuteExport,
}) {
  if (!showExportModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5">
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
          <h2 className="text-xl font-bold">Export Library</h2>
          <button
            onClick={() => !exporting && setShowExportModal(false)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">
            Export Format
          </label>
          <div className="flex gap-4">
            {['csv', 'pdf', 'json'].map((fmt) => (
              <label key={fmt} className="flex items-center gap-2 cursor-pointer uppercase text-sm font-medium">
                <input
                  type="radio"
                  name="format"
                  value={fmt}
                  checked={exportFormat === fmt}
                  onChange={(e) => setExportFormat(e.target.value)}
                  disabled={exporting}
                  className="accent-blue-600"
                />
                {fmt}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">
            Fields to Include
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg">
            {AVAILABLE_FIELDS.map((field) => (
              <label key={field.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field.key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedFields([...selectedFields, field.key]);
                    } else {
                      setSelectedFields(selectedFields.filter((k) => k !== field.key));
                    }
                  }}
                  disabled={exporting}
                  className="rounded accent-blue-600"
                />
                {field.label}
              </label>
            ))}
          </div>
        </div>

        {exporting && (
          <div className="space-y-2 text-center py-2">
            <div className="flex items-center justify-center gap-2 text-blue-600 font-semibold">
              <span className="animate-spin text-xl">🌀</span> Fetching card details... {exportProgress}%
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-200"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 pt-4">
          <button
            onClick={() => setShowExportModal(false)}
            disabled={exporting}
            className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExecuteExport}
            disabled={exporting || selectedFields.length === 0}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Download Export'}
          </button>
        </div>
      </div>
    </div>
  );
}