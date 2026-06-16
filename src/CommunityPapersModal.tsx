import React, { useState, useEffect } from 'react';
import { API_BASE } from './api';

interface Paper {
    id: number;
    title: string;
    year: number | null;
    citations: number;
    abstract: string;
    author: string;
    local_citations?: number;
    subcommunity?: number;
    journal?: string;
    doi?: string;
}

interface CommunityPapersModalProps {
    jobId: string; // NEW
    communityId: number;
    communityName: string;
    papers: Paper[];
    onClose: () => void;
    scopusApiKey?: string;
    scopusInstToken?: string;
    onOpenScopusModal?: () => void;
    onOpenContentAnalysis: (params: {
        jobId: string;
        communityId: number;
        communityName: string;
        selectedPaperIds: number[];
        preSelectedPapersCount: number;
    }) => void;
}

const CommunityPapersModal: React.FC<CommunityPapersModalProps> = ({
    jobId,
    communityId,
    communityName,
    papers,
    onClose,
    scopusApiKey,
    scopusInstToken,
    onOpenScopusModal,
    onOpenContentAnalysis
}) => {
    const [expandedRow, setExpandedRow] = useState<string | number | null>(null);
    const [pdfLoading, setPdfLoading] = useState<string | null>(null);
    const [pdfStatus, setPdfStatus] = useState<Record<number, boolean>>({});
    const [pdfFilenames, setPdfFilenames] = useState<Record<number, string>>({});
    const [fetchMessage, setFetchMessage] = useState<string | null>(null);
    const [uploadingId, setUploadingId] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    // Internal state moved to App.tsx via callback
    // const [isContentAnalysisOpen, setIsContentAnalysisOpen] = useState(false);

    // Initial load
    useEffect(() => {
        if (jobId) {
            loadPdfStatus();
        }
    }, [jobId]);

    const loadPdfStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/pdf-status/${jobId}`);
            if (res.ok) {
                const data = await res.json();
                const statusMap: Record<number, boolean> = {};
                const fileMap: Record<number, string> = {};
                if (data.papers) {
                    data.papers.forEach((p: any) => {
                        statusMap[p.id] = p.has_pdf;
                        if (p.has_pdf) fileMap[p.id] = p.filename;
                    });
                }
                setPdfStatus(statusMap);
                setPdfFilenames(fileMap);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            // Select all currently visible papers? Or all papers in community?
            // "get them all together" implies all in this list.
            setSelectedIds(new Set(papers.map(p => p.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleFetchSelected = async () => {
        if (selectedIds.size === 0) return;
        setFetchMessage("Starting fetch...");
        try {
            const res = await fetch(`${API_BASE}/fetch-pdfs/${jobId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paper_ids: Array.from(selectedIds) })
            });
            const data = await res.json();
            setFetchMessage(data.message);
            setSelectedIds(new Set());
            // Poll for updates
            setTimeout(loadPdfStatus, 3000);
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
                body: formData
            });
            if (res.ok) {
                await loadPdfStatus();
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

    // Pagination
    const [currentPage, setCurrentPage] = useState(0);
    const pageSize = 50; // Increased page size for easier bulk management

    // Safety check
    const safePapers = papers || [];

    const totalPages = Math.ceil(safePapers.length / pageSize);
    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, safePapers.length);
    const currentPapers = safePapers.slice(startIndex, endIndex);

    const toggleRow = (id: string | number) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const handleGetPdf = async (doi: string | undefined, paperId: string | number) => {
        let targetDoi = doi;

        setPdfLoading(String(paperId));

        try {
            // 1. Try Scopus API if no DOI
            if (!targetDoi) {
                if (!scopusApiKey) {
                    if (confirm("No DOI found. Using Scopus API requires an API Key. Open settings?")) {
                        onOpenScopusModal?.();
                    }
                    setPdfLoading(null);
                    return;
                }

                try {
                    const headers: any = {
                        'X-ELS-APIKey': scopusApiKey,
                        'Accept': 'application/json'
                    };
                    if (scopusInstToken) headers['X-ELS-Insttoken'] = scopusInstToken;

                    // Heuristic: check if ID looks like a Scopus EID (usually contains "-")
                    // If it's just a raw number, it might be an internal ID, but let's try anyway if user insists
                    const response = await fetch(`https://api.elsevier.com/content/abstract/eid/${paperId}`, { headers });

                    if (response.ok) {
                        const data = await response.json();
                        const fetchedDoi = data['abstracts-retrieval-response']?.coredata?.['prism:doi'];
                        if (fetchedDoi) {
                            targetDoi = fetchedDoi;
                            console.log("Fetched DOI from Scopus:", targetDoi);
                        }
                    }
                } catch (err) {
                    console.error("Scopus API check failed", err);
                }
            }

            if (!targetDoi) {
                alert("No DOI available (and Scopus lookup failed or skipped).");
                setPdfLoading(null);
                return;
            }

            // 2. Use Unpaywall with the DOI logic (existing)
            // 2. Try Unpaywall
            try {
                const response = await fetch(`https://api.unpaywall.org/v2/${targetDoi}?email=nicolas@antigravity.com`);
                if (!response.ok) throw new Error(`Status ${response.status}`);
                const data = await response.json();

                if (data.best_oa_location?.url_for_pdf) {
                    window.open(data.best_oa_location.url_for_pdf, '_blank');
                    return;
                } else if (data.best_oa_location?.url) {
                    window.open(data.best_oa_location.url, '_blank');
                    return;
                }
            } catch (unpaywallErr) {
                console.warn("Unpaywall API failed, trying OpenAlex...", unpaywallErr);
            }

            // 3. Fallback to OpenAlex
            try {
                const response = await fetch(`https://api.openalex.org/works/https://doi.org/${targetDoi}`);
                if (!response.ok) throw new Error(`OpenAlex Status ${response.status}`);
                const data = await response.json();

                if (data.open_access?.oa_url) {
                    window.open(data.open_access.oa_url, '_blank');
                    return;
                }
            } catch (openAlexErr) {
                console.warn("OpenAlex API failed", openAlexErr);
            }

            alert("No open access PDF found for this paper (checked Unpaywall & OpenAlex).");
        } catch (e) {
            console.error(e);
            let msg = "Failed to Check Unpaywall or no PDF found.";
            if (e instanceof Error) msg += "\nError: " + e.message;
            alert(msg);
        } finally {
            setPdfLoading(null);
        }
    };

    const goToNextPage = () => {
        if (currentPage < totalPages - 1) {
            setCurrentPage(currentPage + 1);
            setExpandedRow(null);
        }
    };

    const goToPrevPage = () => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
            setExpandedRow(null);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '8px',
                width: '98%',
                maxWidth: 'none',
                height: '95vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                color: '#333'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                            Papers in Community {communityId + 1}: {communityName}
                        </h2>
                        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                            PDFs: <span style={{
                                background: Object.values(pdfStatus).filter(Boolean).length > 0 ? '#10b981' : '#94a3b8',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontWeight: 'bold',
                                fontSize: '0.8rem'
                            }}>
                                {papers.filter(p => pdfStatus[p.id]).length} / {papers.length}
                            </span> papers have PDFs available
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button

                            onClick={() => onOpenContentAnalysis({
                                jobId,
                                communityId,
                                communityName,
                                selectedPaperIds: Array.from(selectedIds),
                                preSelectedPapersCount: papers.length
                            })}
                            title={!jobId ? "Job ID missing (re-upload CSV needed)" : "Run Deep Content Analysis"}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: '#2563eb',
                                color: 'white',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                opacity: !jobId ? 0.7 : 1
                            }}
                        >
                            📊 Deep S3 Analysis
                        </button>
                        {selectedIds.size > 0 && (
                            <button
                                onClick={handleFetchSelected}
                                style={{
                                    background: '#ff5722',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '0.4rem 0.8rem',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    marginRight: '10px'
                                }}
                            >
                                📥 Fetch {selectedIds.size} Papers
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '1.5rem',
                                cursor: 'pointer',
                                padding: '0 10px'
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                Showing {startIndex + 1}-{endIndex} of {papers.length} papers
                            </div>
                            {fetchMessage && <span style={{ color: 'green', fontSize: '0.9rem' }}>{fetchMessage}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <button
                                onClick={goToPrevPage}
                                disabled={currentPage === 0}
                                style={{
                                    padding: '5px 15px',
                                    borderRadius: '4px',
                                    cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                                    opacity: currentPage === 0 ? 0.5 : 1
                                }}
                            >
                                ← Previous
                            </button>
                            <span style={{ fontSize: '0.9rem', color: '#666' }}>
                                Page {currentPage + 1} of {totalPages}
                            </span>
                            <button
                                onClick={goToNextPage}
                                disabled={currentPage >= totalPages - 1}
                                style={{
                                    padding: '5px 15px',
                                    borderRadius: '4px',
                                    cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                                    opacity: currentPage >= totalPages - 1 ? 0.5 : 1
                                }}
                            >
                                Next →
                            </button>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', textAlign: 'left', color: '#333' }}>
                                <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '30px' }}>
                                    <input
                                        type="checkbox"
                                        checked={papers.length > 0 && selectedIds.size === papers.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                </th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Title</th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '60px' }}>Year</th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Journal</th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '80px' }}>Global Cites</th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '80px' }}>Local Cites</th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '120px' }}>PDF</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentPapers.map((paper) => {
                                const hasPdf = pdfStatus[paper.id];
                                const isSelected = selectedIds.has(paper.id);
                                return (
                                    <React.Fragment key={paper.id}>
                                        <tr style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '10px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        const newSet = new Set(selectedIds);
                                                        if (e.target.checked) newSet.add(paper.id);
                                                        else newSet.delete(paper.id);
                                                        setSelectedIds(newSet);
                                                    }}
                                                    disabled={hasPdf}
                                                />
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <div
                                                    style={{ fontWeight: 'bold', cursor: 'pointer', color: '#0066cc', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                    onClick={() => toggleRow(paper.id)}
                                                >
                                                    <span style={{ fontSize: '0.8em' }}>{expandedRow === paper.id ? '▼' : '▶'}</span>
                                                    {paper.title}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                                                    {paper.author || 'Unknown Author'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px' }}>{paper.year || '-'}</td>
                                            <td style={{ padding: '10px', fontStyle: 'italic', color: '#555' }}>
                                                {paper.journal || '-'}
                                            </td>
                                            <td style={{ padding: '10px' }}>{paper.citations}</td>
                                            <td style={{ padding: '10px' }}>{paper.local_citations ?? '-'}</td>
                                            <td style={{ padding: '10px' }}>
                                                {hasPdf ? (
                                                    <a href={`${API_BASE}/unprotected/full_papers/${pdfFilenames[paper.id]}`} target="_blank" rel="noopener noreferrer">✅ View</a>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleGetPdf(paper.doi, paper.id);
                                                            }}
                                                            disabled={pdfLoading === String(paper.id)}
                                                            style={{
                                                                padding: '2px 6px',
                                                                fontSize: '11px',
                                                                background: '#eee',
                                                                color: '#333',
                                                                border: '1px solid #ccc',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Find
                                                        </button>
                                                        <label style={{ cursor: 'pointer', color: 'blue', fontSize: '11px', textDecoration: 'underline' }}>
                                                            {uploadingId === paper.id ? '...' : 'Upload'}
                                                            <input
                                                                type="file"
                                                                style={{ display: 'none' }}
                                                                accept=".pdf"
                                                                onChange={e => {
                                                                    if (e.target.files?.[0]) {
                                                                        handleFileUpload(paper.id, e.target.files[0]);
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                        {expandedRow === paper.id && (
                                            <tr style={{ background: '#f9f9f9', color: '#333' }}>
                                                <td colSpan={7} style={{ padding: '15px', borderBottom: '1px solid #eee' }}>
                                                    <strong>Abstract:</strong>
                                                    <p style={{ margin: '5px 0 0 0', lineHeight: '1.4', color: '#333' }}>
                                                        {paper.abstract || <em>No abstract available.</em>}
                                                    </p>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CommunityPapersModal;
