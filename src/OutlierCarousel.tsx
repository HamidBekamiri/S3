import React, { useState } from 'react';
import { assignOutlier } from './api';

interface OutlierPaper {
    id: number;
    title: string;
    citations: number;
    year: number | null;
    authors: string;
    inclusion_threshold?: number;
    suggested_community?: number | null;
}

interface OutlierCarouselProps {
    outliers: OutlierPaper[];
    llmLabels: Record<string, string>;
    jobId: string;
    onAssignOutlier: (paperId: number) => void;
}

const OutlierCarousel: React.FC<OutlierCarouselProps> = ({ outliers, llmLabels, jobId, onAssignOutlier }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Reset index if outliers change or current index is out of bounds
    React.useEffect(() => {
        if (currentIndex >= outliers.length) {
            setCurrentIndex(0);
        }
    }, [outliers, currentIndex]);

    if (!outliers || outliers.length === 0) {
        return (
            <div className="message info">
                No outliers found. All papers are well-connected.
            </div>
        );
    }

    const currentPaper = outliers[currentIndex];

    // Safety check if currentPaper is undefined even after length check (unexpected state)
    if (!currentPaper) {
        return null;
    }

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % outliers.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + outliers.length) % outliers.length);
    };

    const handleAssign = async () => {
        if (currentPaper.suggested_community === null || currentPaper.suggested_community === undefined) return;
        try {
            await assignOutlier(jobId, currentPaper.id, currentPaper.suggested_community);
            onAssignOutlier(currentPaper.id);
            // Index adjustment handled by useEffect, but we can optimistically set it here too
            if (outliers.length <= 1) {
                // If we are removing the last one, it will become empty, handled by early return.
            } else if (currentIndex >= outliers.length - 1) {
                // If we were at the end, go to 0 or previous
                setCurrentIndex(0);
            }
        } catch (err: any) {
            alert("Failed to assign outlier: " + (err.message || err));
        }
    };

    return (
        <div className="outlier-window-container">
            <div className="outlier-window">
                {/* Navigation Left */}
                <button
                    className="nav-button window-nav left"
                    onClick={handlePrev}
                    title="Previous Paper"
                    style={{ visibility: outliers.length > 1 ? 'visible' : 'hidden' }}
                >
                    ←
                </button>

                {/* Card Content */}
                <div className="outlier-slide-card">
                    <div className="slide-header">
                        <span className="slide-index">{currentIndex + 1} / {outliers.length}</span>
                        <div className="slide-metrics">
                            <span className="metric-pill">Citations: <strong>{currentPaper.citations}</strong></span>
                            <span className="metric-pill">Threshold: <strong>{currentPaper.inclusion_threshold?.toFixed(2) ?? "N/A"}</strong></span>
                        </div>
                    </div>

                    <h3 className="slide-title">{currentPaper.title}</h3>

                    <div className="slide-meta">
                        <div className="meta-row">
                            <span className="meta-label">Authors:</span>
                            <span className="meta-value">{currentPaper.authors}</span>
                        </div>
                        <div className="meta-row">
                            <span className="meta-label">Year:</span>
                            <span className="meta-value">{currentPaper.year || "N/A"}</span>
                        </div>
                    </div>

                    <div className="slide-action-area">
                        <span className="suggestion-label">Suggested Community:</span>
                        {currentPaper.suggested_community !== null && currentPaper.suggested_community !== undefined ? (
                            <div className="suggestion-box">
                                <div className="community-info">
                                    <span className="community-id">Community {currentPaper.suggested_community + 1}</span>
                                    {llmLabels[currentPaper.suggested_community] && (
                                        <span className="community-name">"{llmLabels[currentPaper.suggested_community]}"</span>
                                    )}
                                </div>
                                <button
                                    className="primary-button small"
                                    onClick={handleAssign}
                                >
                                    Assign to Community
                                </button>
                            </div>
                        ) : (
                            <span className="no-suggestion">None available</span>
                        )}
                    </div>
                </div>

                {/* Navigation Right */}
                <button
                    className="nav-button window-nav right"
                    onClick={handleNext}
                    title="Next Paper"
                >
                    →
                </button>
            </div>
        </div>
    );
};

export default OutlierCarousel;
