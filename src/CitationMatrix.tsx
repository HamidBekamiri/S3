import React, { useState, useEffect, useMemo } from 'react';
import { fetchCitationMatrix } from './api';

interface CitationConfusionMatrix {
    community_ids: number[];
    matrix: number[][];
    labels?: string[];
    rankings?: {
        by_size: { id: string; label: string; count: number }[];
        by_citation: { id: string; label: string; count: number }[];
    };
}

interface Props {
    usecase: string;
    jobId?: string; // Optional, for context
    forcedTopN?: number; // Optional, to sync with external slider
    onCommunityClick?: (communityId: number) => void;
}

const CitationMatrix: React.FC<Props> = ({ usecase, jobId, forcedTopN, onCommunityClick }) => {
    const [localTopN, setLocalTopN] = useState<number>(10);
    const topN = forcedTopN !== undefined ? forcedTopN : localTopN;

    const [threshold, setThreshold] = useState<number>(0);
    const [data, setData] = useState<CitationConfusionMatrix | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!usecase) return;

        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Determine effective usecase, prioritizing M&A if jobId matches
                let effectiveUsecase = usecase;
                if (jobId === "usecase_mergers_acquisition") effectiveUsecase = "mergers_acquisition";

                console.log(`[CitationMatrix] Fetching with topN=${topN} for usecase=${effectiveUsecase}`);
                const result = await fetchCitationMatrix(effectiveUsecase, topN);
                if (result) {
                    console.log(`[CitationMatrix] Received ${result.ids.length} communities`);
                    setData({
                        community_ids: result.ids.map(id => parseInt(id)),
                        matrix: result.matrix,
                        labels: result.labels,
                        rankings: result.rankings
                    });
                }
            } catch (err: any) {
                console.error("Failed to fetch citation matrix:", err);
                setError(err.message || "Failed to load matrix");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [usecase, jobId, topN]);

    // Compute display data
    const displayData = useMemo(() => {
        if (!data || !data.community_ids || !data.matrix) {
            return null;
        }

        const ids = data.community_ids;
        const matrix = data.matrix;

        // Find max value in ORIGINAL data
        let maxVal = 0;
        for (const row of matrix) {
            for (const val of row) {
                if (val > maxVal) maxVal = val;
            }
        }

        // Build labels
        const labels = ids.map((id, idx) => {
            if (data.labels && data.labels[idx]) {
                const raw = data.labels[idx];
                return raw.length > 25 ? raw.slice(0, 22) + '...' : raw;
            }
            return `Community ${id + 1}`;
        });

        // Filter Matrix
        const filteredMatrix = matrix.map(row =>
            row.map(val => (val < threshold ? 0 : val))
        );

        return { ids, matrix: filteredMatrix, maxVal, labels };
    }, [data, threshold]);

    // Heatmap color scale: beige/yellow (low) → teal/green (medium) → blue (high)
    const getColor = (value: number, max: number) => {
        if (value === 0) return '#fafafa'; // Very light gray for zero values
        if (max === 0) return '#fffbea'; // Light beige

        const ratio = value / max;

        // Define color stops for the gradient
        // Low values (0-0.2): Light beige/yellow
        if (ratio <= 0.2) {
            const t = ratio / 0.2;
            return interpolateColor('#fffbea', '#f7f6d0', t);
        }
        // Medium-low values (0.2-0.4): Yellow to light green
        else if (ratio <= 0.4) {
            const t = (ratio - 0.2) / 0.2;
            return interpolateColor('#f7f6d0', '#c7e9c0', t);
        }
        // Medium values (0.4-0.6): Light green to teal
        else if (ratio <= 0.6) {
            const t = (ratio - 0.4) / 0.2;
            return interpolateColor('#c7e9c0', '#74c476', t);
        }
        // Medium-high values (0.6-0.8): Teal to light blue
        else if (ratio <= 0.8) {
            const t = (ratio - 0.6) / 0.2;
            return interpolateColor('#74c476', '#41b6c4', t);
        }
        // High values (0.8-1.0): Light blue to dark blue
        else {
            const t = (ratio - 0.8) / 0.2;
            return interpolateColor('#41b6c4', '#2c7fb8', t);
        }
    };

    // Interpolate between two hex colors
    const interpolateColor = (color1: string, color2: string, factor: number) => {
        const c1 = hexToRgb(color1);
        const c2 = hexToRgb(color2);
        const r = Math.round(c1.r + (c2.r - c1.r) * factor);
        const g = Math.round(c1.g + (c2.g - c1.g) * factor);
        const b = Math.round(c1.b + (c2.b - c1.b) * factor);
        return `rgb(${r}, ${g}, ${b})`;
    };

    // Convert hex to RGB
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    };

    const getTextColor = (value: number, max: number) => {
        if (value === 0) return '#999';
        if (max === 0) return '#000';
        // Use white text for darker backgrounds (higher values)
        return (value / max) > 0.6 ? '#fff' : '#000';
    };

    const downloadCSV = () => {
        if (!displayData) return;

        const { labels, matrix } = displayData;

        // Helper function to escape CSV values
        const escapeCSV = (value: string) => {
            // If value contains comma, double quote, or newline, wrap in quotes and escape internal quotes
            if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        };

        // Header row: "Citing \ Cited", then labels
        const start = "Citing / Cited";
        const header = [start, ...labels.map(escapeCSV)].join(",");

        // Data rows
        const rows = matrix.map((row, i) => {
            const rowLabel = escapeCSV(labels[i]);
            return [rowLabel, ...row].join(",");
        });

        const csvContent = [header, ...rows].join("\n");

        // Create blob and download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `citation_matrix_N${topN}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading && !data) return <div style={{ padding: '1rem', color: '#666' }}>Loading citation matrix...</div>;
    if (error) return <div style={{ padding: '1rem', color: 'red' }}>Error: {error}</div>;
    if (!displayData) {
        return <div style={{ color: '#999' }}>No citation matrix data available.</div>;
    }

    return (
        <div>
            <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ fontWeight: 500, minWidth: '140px' }}>Top Communities (N): {topN}</label>
                    {forcedTopN === undefined && (
                        <>
                            <input
                                type="range"
                                min="5"
                                max="30"
                                value={topN}
                                onChange={(e) => setLocalTopN(Number(e.target.value))}
                                style={{ width: '200px' }}
                            />
                            <span style={{ fontSize: '0.8rem', color: '#666' }}>
                                (Fetches fresh data)
                            </span>
                        </>
                    )}
                    {forcedTopN !== undefined && (
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>
                            (Synced with Chord Diagram)
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ fontWeight: 500, minWidth: '140px' }}>Min Citations: {threshold}</label>
                    <input
                        type="range"
                        min="0"
                        max={displayData.maxVal > 0 ? Math.min(100, displayData.maxVal) : 10}
                        step="1"
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        style={{ width: '200px' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>
                        (Filters displayed values)
                    </span>
                </div>
                <div style={{ alignSelf: 'flex-start' }}>
                    <button
                        onClick={downloadCSV}
                        style={{
                            padding: '6px 12px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            background: '#fff',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            color: '#333'
                        }}
                    >
                        📥 Download CSV
                    </button>
                </div>
            </div>

            <div style={{
                overflowX: 'auto',
                border: '3px solid #4285f4',
                borderRadius: '8px',
                padding: '1rem',
                background: 'white'
            }}>
                <div style={{ position: 'relative', paddingLeft: '40px' }}>
                    {/* Y-axis label */}
                    <div style={{
                        position: 'absolute',
                        left: '0px',
                        top: '50%',
                        transform: 'translateY(-50%) rotate(-90deg)',
                        transformOrigin: 'center',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: '#333',
                        whiteSpace: 'nowrap',
                        width: '20px', // constrain width for rotation center
                        textAlign: 'center'
                    }}>
                        Citing Community
                    </div>

                    <table style={{
                        borderCollapse: 'collapse',
                        fontSize: '0.85rem',
                        width: 'auto', // Auto width to fit fixed columns
                        margin: '0 auto',
                        tableLayout: 'fixed' // Enforce fixed layout
                    }}>
                        <thead>
                            <tr>
                                <th style={{
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    width: '50px', // Fixed width for row header column
                                    height: '50px', // Match column header height
                                    textAlign: 'left',
                                    background: '#f5f5f5',
                                    fontWeight: 600
                                }}>

                                </th>
                                {displayData.labels.map((label, i) => (
                                    <th
                                        key={i}
                                        style={{
                                            padding: '8px',
                                            border: '1px solid #ddd',
                                            height: '50px', // Match cell height for uniform grid
                                            width: '50px', // Uniform cell width
                                            whiteSpace: 'nowrap',
                                            fontSize: '0.8rem',
                                            textAlign: 'center', // Center align number
                                            background: '#e0e0e0', // Darker gray for headers
                                            fontWeight: 'bold', // Bold font
                                            color: '#000', // Black text
                                            textDecoration: 'underline', // Underline
                                            cursor: onCommunityClick ? 'pointer' : 'default'
                                        }}
                                        onClick={() => onCommunityClick && onCommunityClick(displayData.ids[i])}
                                        title={`View papers in Community ${label}`}
                                    >
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.matrix.map((row, i) => (
                                <tr key={i}>
                                    <td
                                        style={{
                                            padding: '8px',
                                            border: '1px solid #ddd',
                                            fontWeight: 'bold', // Bold font
                                            fontSize: '0.75rem',
                                            background: '#e0e0e0', // Darker gray for headers
                                            color: '#000', // Black text
                                            textDecoration: 'underline', // Underline
                                            width: '50px', // Fixed width
                                            height: '50px', // Square-ish cell height
                                            textAlign: 'center', // Center text
                                            cursor: onCommunityClick ? 'pointer' : 'default'
                                        }}
                                        onClick={() => onCommunityClick && onCommunityClick(displayData.ids[i])}
                                        title={`View papers in Community ${displayData.labels[i]}`}
                                    >
                                        {displayData.labels[i]}
                                    </td>
                                    {row.map((val, j) => (
                                        <td
                                            key={j}
                                            style={{
                                                padding: '10px',
                                                border: '1px solid #ddd',
                                                textAlign: 'center',
                                                backgroundColor: getColor(val, displayData.maxVal),
                                                color: getTextColor(val, displayData.maxVal),
                                                minWidth: '50px', // Uniform cell width
                                                width: '50px', // Uniform cell width
                                                height: '50px', // Uniform cell height
                                                fontWeight: 500,
                                                fontSize: '0.8rem'
                                            }}
                                            title={`${displayData.labels[i]} → ${displayData.labels[j]}: ${val} citations`}
                                        >
                                            {val > 0 ? val : ''}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* X-axis label */}
                    <div style={{
                        textAlign: 'center',
                        marginTop: '0.5rem',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: '#333'
                    }}>
                        Cited Community
                    </div>
                </div>
            </div>

            {/* Color scale legend */}
            <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: '#f9f9f9',
                borderRadius: '6px',
                border: '1px solid #ddd'
            }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: '#333' }}>
                    Citation Count Scale:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>Low</span>
                    <div style={{ display: 'flex', height: '20px', flex: 1, minWidth: '200px', border: '1px solid #ccc', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ flex: 1, background: '#fffbea' }} />
                        <div style={{ flex: 1, background: '#f7f6d0' }} />
                        <div style={{ flex: 1, background: '#c7e9c0' }} />
                        <div style={{ flex: 1, background: '#74c476' }} />
                        <div style={{ flex: 1, background: '#41b6c4' }} />
                        <div style={{ flex: 1, background: '#2c7fb8' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>High</span>
                    <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '0.5rem' }}>
                        (Max: {displayData.maxVal})
                    </span>
                </div>
            </div>

            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                * Rows: Citing (source) community; Columns: Cited (target) community.
                <br />
                * Data computed from explicit references (df_ref_all) for maximum accuracy.
            </div>


        </div >
    );
};

export default CitationMatrix;
