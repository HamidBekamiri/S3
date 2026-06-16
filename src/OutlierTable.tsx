import React, { useState } from 'react';

interface Outlier {
    id: number;
    title: string;
    citations: number;
    year: number | null;
    authors: string;
    abstract?: string;
    inclusion_threshold?: number;
    suggested_community?: number | null;
}

interface Community {
    id: number;
    n_papers: number;
}

interface OutlierTableProps {
    outliers: Outlier[];
    communities: Community[];
    onAssignToCommunity: (paperId: number, communityId: number) => Promise<void>;
}

const OutlierTable: React.FC<OutlierTableProps> = ({ outliers, communities, onAssignToCommunity }) => {
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(0);

    const itemsPerPage = 10;

    // Check if outliers is defined before accessing length
    const safeOutliers = outliers || [];

    const totalPages = Math.ceil(safeOutliers.length / itemsPerPage);
    const startIndex = currentPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, safeOutliers.length);
    const visibleOutliers = safeOutliers.slice(startIndex, endIndex);

    const toggleRow = (id: number) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const handleAssign = (outlierId: number, communityIdString: string) => {
        const communityId = parseInt(communityIdString);
        if (!isNaN(communityId)) {
            onAssignToCommunity(outlierId, communityId);
        }
    };

    const goToNextPage = () => {
        if (currentPage < totalPages - 1) {
            setCurrentPage(currentPage + 1);
            setExpandedRow(null); // Collapse any expanded rows when changing pages
        }
    };

    const goToPrevPage = () => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
            setExpandedRow(null); // Collapse any expanded rows when changing pages
        }
    };

    if (!outliers || outliers.length === 0) {
        return (
            <div className="message info">
                No outliers found. All papers were successfully assigned to communities.
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    Showing {startIndex + 1}-{endIndex} of {outliers.length} outliers
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

            <div className="outlier-table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ background: '#f5f5f5', textAlign: 'left', color: '#333' }}>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Title</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '60px' }}>Year</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '60px' }}>Cites</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #ddd', width: '250px' }}>Assign Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleOutliers.map((outlier) => (
                            <React.Fragment key={outlier.id}>
                                <tr style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '10px' }}>
                                        <div style={{ fontWeight: 'bold', cursor: 'pointer', color: '#0066cc', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => toggleRow(outlier.id)}>
                                            <span style={{ fontSize: '0.8em' }}>{expandedRow === outlier.id ? '▼' : '▶'}</span>
                                            {outlier.title}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                                            {outlier.authors}
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px' }}>{outlier.year || '-'}</td>
                                    <td style={{ padding: '10px' }}>{outlier.citations}</td>
                                    <td style={{ padding: '10px' }}>
                                        <select
                                            style={{ padding: '5px', borderRadius: '4px', width: '100%', maxWidth: '200px', color: '#333', backgroundColor: '#fff' }}
                                            onChange={(e) => handleAssign(outlier.id, e.target.value)}
                                            value=""
                                        >
                                            <option value="" disabled>Select Community...</option>
                                            <option value={outlier.suggested_community ?? -1} style={{ fontWeight: 'bold', color: 'green' }}>
                                                {outlier.suggested_community != null ? `Recommended: Community ${outlier.suggested_community + 1}` : 'No Recommendation'}
                                            </option>
                                            <optgroup label="All Communities">
                                                {communities.map(c => (
                                                    <option key={c.id} value={c.id}>Community {c.id + 1} ({c.n_papers} papers)</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </td>
                                </tr>
                                {expandedRow === outlier.id && (
                                    <tr style={{ background: '#f9f9f9', color: '#333' }}>
                                        <td colSpan={4} style={{ padding: '15px', borderBottom: '1px solid #eee' }}>
                                            <strong>Abstract:</strong>
                                            <p style={{ margin: '5px 0 0 0', lineHeight: '1.4', color: '#333' }}>
                                                {outlier.abstract || <em>No abstract available.</em>}
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OutlierTable;
