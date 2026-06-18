import React, { useState, useEffect } from 'react';
import { API_BASE } from './api';
import { withAuthHeaders } from './authToken';

interface PaperStatus {
    id: number;
    title: string;
    doi: string;
    has_pdf: boolean;
    filename: string;
}

interface PDFManagerModalProps {
    jobId: string;
    isOpen: boolean;
    onClose: () => void;
    filterIds?: number[] | null; // Optional list of IDs to show
}

const PDFManagerModal: React.FC<PDFManagerModalProps> = ({ jobId, isOpen, onClose, filterIds }) => {
    const [papers, setPapers] = useState<PaperStatus[]>([]);
    const [stats, setStats] = useState<{ total: number; downloaded: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [fetchMessage, setFetchMessage] = useState<string | null>(null);
    const [uploadingId, setUploadingId] = useState<number | null>(null);
    const [showAll, setShowAll] = useState(false); // Toggle to ignore filter

    const loadStatus = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/pdf-status/${jobId}`, { headers: withAuthHeaders() });
            if (!res.ok) throw new Error("Failed to load status");
            const data = await res.json();
            setPapers(data.papers);
            setStats(data.stats);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadStatus();
            setShowAll(false); // Reset showAll when reopening
            setSelectedIds(new Set()); // Reset selection
            setFetchMessage(null);
        }
    }, [isOpen, jobId]);

    // Apply filter
    const displayedPapers = React.useMemo(() => {
        if (!filterIds || showAll) return papers;
        const idSet = new Set(filterIds);
        return papers.filter(p => idSet.has(p.id));
    }, [papers, filterIds, showAll]);

    const handleSelectAll = (deselect = false) => {
        if (deselect) {
            setSelectedIds(new Set());
        } else {
            // Select only missing from DISPLAYED papers
            const missing = displayedPapers.filter(p => !p.has_pdf).map(p => p.id);
            setSelectedIds(new Set(missing));
        }
    };

    const handleFetchSelected = async () => {
        if (selectedIds.size === 0) return;
        setFetchMessage("Starting fetch...");
        try {
            const res = await fetch(`${API_BASE}/fetch-pdfs/${jobId}`, {
                method: "POST",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ paper_ids: Array.from(selectedIds) })
            });
            const data = await res.json();
            setFetchMessage(data.message);

            // Clear selection
            setSelectedIds(new Set());

            // Reload status after a delay to show progress? 
            // Better: User manually refreshes or we poll. 
            // For now, simple reload after 2s.
            setTimeout(loadStatus, 2000);
        } catch (err) {
            console.error(err);
            setFetchMessage("Error starting fetch.");
        }
    };

    const handleFileUpload = async (paperId: number, file: File) => {
        setUploadingId(paperId);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_BASE}/upload-pdf/${jobId}/${paperId}`, {
                method: 'POST',
                headers: withAuthHeaders(),
                body: formData
            });
            if (res.ok) {
                // Success
                await loadStatus();
            } else {
                alert("Upload failed");
            }
        } catch (err) {
            console.error(err);
            alert("Upload error");
        } finally {
            setUploadingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '900px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h3>Manage PDFs</h3>
                    <button onClick={onClose} className="close-button">×</button>
                </div>

                <div style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <strong>Status: </strong>
                            {stats ? `${stats.downloaded} / ${stats.total} found` : "Loading..."}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={loadStatus} disabled={loading}>Refresh</button>
                            <button onClick={() => handleSelectAll(false)}>Select Missing</button>
                            <button onClick={() => handleSelectAll(true)}>Deselect All</button>
                            <button
                                onClick={handleFetchSelected}
                                disabled={selectedIds.size === 0}
                                style={{ background: 'var(--accent)', color: 'white' }}
                            >
                                Fetch Selected ({selectedIds.size})
                            </button>
                        </div>
                    </div>

                    {filterIds && !showAll && (
                        <div style={{ background: '#e3f2fd', padding: '8px', borderRadius: '4px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Filtered View: Showing {displayedPapers.length} papers.</span>
                            <button onClick={() => setShowAll(true)} style={{ fontSize: '0.8rem', padding: '2px 8px' }}>Show All</button>
                        </div>
                    )}
                    {filterIds && showAll && (
                        <div style={{ marginBottom: '1rem' }}>
                            <button onClick={() => setShowAll(false)} style={{ fontSize: '0.8rem', padding: '2px 8px' }}>Back to Filtered View</button>
                        </div>
                    )}

                    {fetchMessage && <div style={{ color: 'green', fontSize: '0.9rem' }}>{fetchMessage}</div>}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    <table className="table small" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ width: 30 }}></th>
                                <th>Title</th>
                                <th>DOI</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedPapers.map(p => (
                                <tr key={p.id} style={{ opacity: p.has_pdf ? 0.7 : 1 }}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(p.id)}
                                            onChange={e => {
                                                const newSet = new Set(selectedIds);
                                                if (e.target.checked) newSet.add(p.id);
                                                else newSet.delete(p.id);
                                                setSelectedIds(newSet);
                                            }}
                                            disabled={p.has_pdf}
                                        />
                                    </td>
                                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.title}>
                                        {p.title}
                                    </td>
                                    <td>{p.doi}</td>
                                    <td>
                                        {p.has_pdf ? '✅ Found' : '❌ Missing'}
                                    </td>
                                    <td>
                                        {p.has_pdf ? (
                                            <a href={`${API_BASE}/unprotected/full_papers/${p.filename}`} target="_blank" rel="noopener noreferrer">View</a>
                                        ) : (
                                            <label style={{ cursor: 'pointer', color: 'blue', textDecoration: 'underline' }}>
                                                {uploadingId === p.id ? 'Uploading...' : 'Upload'}
                                                <input
                                                    type="file"
                                                    style={{ display: 'none' }}
                                                    accept=".pdf"
                                                    onChange={e => {
                                                        if (e.target.files?.[0]) {
                                                            handleFileUpload(p.id, e.target.files[0]);
                                                        }
                                                    }}
                                                />
                                            </label>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PDFManagerModal;
