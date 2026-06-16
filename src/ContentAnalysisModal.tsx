import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from './api';

interface PaperCompact {
    id: number;
    title: string;
    year: number | null;
    citations: number;
}

interface ContentAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string;
    communityId: number;
    communityName: string;
    selectedPaperIds: number[];
    preSelectedPapersCount: number;
    availablePapers?: PaperCompact[]; // New prop for selection
}

// Result Interfaces
interface Theme {
    cluster_id: number;
    Theme: string;
    cluster_size: number;
    mean_centroid_sim: number | null;
    min_centroid_sim: number | null;
    Prototype_Sents: string;
    Example_Sents: string;
    doc_ids: string[];
    paper_ids: string[];
    sections: string[];
}

interface Aspect {
    aspect_id: number;
    Aspects: string;
    combined_topics: string[];
    num_themes: number;
}

interface AnalysisResults {
    themes: Theme[];
    aspects: Aspect[];
}



export const ContentAnalysisModal: React.FC<ContentAnalysisModalProps> = ({
    isOpen,
    onClose,
    jobId,
    communityId,
    communityName,
    selectedPaperIds,
    preSelectedPapersCount,
    availablePapers = []
}) => {
    const [activeTab, setActiveTab] = useState<'configure' | 'themes' | 'aspects'>('configure');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<AnalysisResults | null>(null);

    // Wizard step state (0: Papers, 1: Sections, 2: Model)
    const [currentStep, setCurrentStep] = useState(0);
    const totalSteps = 3;

    // If initial selection provided, use it. Otherwise, select all available.
    // If neither, empty.
    const [localSelectedIds, setLocalSelectedIds] = useState<number[]>(
        selectedPaperIds && selectedPaperIds.length > 0
            ? selectedPaperIds
            : (availablePapers.map(p => p.id))
    );

    // Configuration State
    const [focusSections, setFocusSections] = useState<Record<string, boolean>>({
        front_matter: true,
        introduction: true,
        literature_review: false,
        methods: true,
        results: true,
        discussion: true,
        conclusion: true,
        results_discussion: true,
    });

    const [modelType, setModelType] = useState<'gemini' | 'local'>('gemini');
    const [apiKey, setApiKey] = useState('');
    const [localModelName, setLocalModelName] = useState('Qwen/QwQ-32B-Preview');
    const [use8bit, setUse8bit] = useState(true);
    const [sentencesPerSection, setSentencesPerSection] = useState(8);

    // Stats
    const [analysisStats, setAnalysisStats] = useState<{ analyzed: number, total: number } | null>(null);

    const sectionsList = [
        { id: 'front_matter', label: 'Abstract / Front Matter' },
        { id: 'introduction', label: 'Introduction' },
        { id: 'literature_review', label: 'Literature Review' },
        { id: 'methods', label: 'Methods' },
        { id: 'results', label: 'Results' },
        { id: 'discussion', label: 'Discussion' },
        { id: 'conclusion', label: 'Conclusion' },
    ];

    const [processingStep, setProcessingStep] = useState<string>("");
    const [progressPercent, setProgressPercent] = useState(0);

    const safeSelectedPaperIds = selectedPaperIds || [];

    // Simulated progress steps for better UX
    React.useEffect(() => {
        let interval: any;
        if (loading) {
            setProgressPercent(0);
            setProcessingStep("Initializing analysis...");
            const steps = [
                { time: 2000, label: "Reading PDFs & extracting text...", pct: 15 },
                { time: 8000, label: "Identifying sections (Intro, Methods, Results)...", pct: 30 },
                { time: 15000, label: "Cleaning text & removing boilerplate...", pct: 45 },
                { time: 22000, label: "Encoding sentences (MPNet Embeddings)...", pct: 60 },
                { time: 35000, label: "Clustering content & identifying themes...", pct: 75 },
                { time: 45000, label: "Generating topic labels (LLM)...", pct: 90 },
                { time: 60000, label: "Finalizing results...", pct: 95 },
            ];

            const startTime = Date.now();
            interval = setInterval(() => {
                const diff = Date.now() - startTime;

                // Polyfill for findLast (use reverse copy)
                const current = [...steps].reverse().find(s => diff >= s.time);

                if (current) {
                    setProcessingStep(current.label);
                    setProgressPercent(current.pct);
                }
            }, 1000);
        } else {
            setProcessingStep("");
            setProgressPercent(0);
            // safeSelectedPaperIds unused in effect but used in render
        }
        return () => clearInterval(interval);
    }, [loading]);

    const handleRunAnalysis = async () => {
        setLoading(true);
        setError(null);
        setResults(null);
        setAnalysisStats(null);

        const selectedSections = Object.entries(focusSections)
            .filter(([_, checked]) => checked)
            .map(([key]) => key);

        if (selectedSections.length === 0) {
            setError("Please select at least one section to focus on.");
            setLoading(false);
            return;
        }

        if (localSelectedIds.length === 0) {
            setError("Please select at least one paper to analyze.");
            setLoading(false);
            return;
        }

        try {
            const payload = {
                focus_sections: selectedSections,
                exclude_sections: [],
                model_type: modelType,
                api_key: modelType === 'gemini' ? apiKey : undefined,
                llm_config: modelType === 'local' ? {
                    model_name: localModelName,
                    use_8bit: use8bit
                } : undefined,
                paper_ids: localSelectedIds,
                sentences_per_section: sentencesPerSection
            };

            const url = `${API_BASE}/analyze/content/${jobId}/${communityId}`;

            console.log("DEBUG: Deep S3 Analysis - Making API call", { API_BASE, jobId, communityId, payload });
            const resp = await axios.post(url, payload);
            console.log("DEBUG: Deep S3 Analysis - Response received", resp.data);

            if (resp.data.error) {
                setError(resp.data.error);
            } else {
                setResults(resp.data.results);
                setAnalysisStats({
                    analyzed: resp.data.papers_analyzed,
                    total: resp.data.total_papers
                });
                setActiveTab('themes');
            }

        } catch (err: any) {
            console.error("Analysis failed", err);
            alert(`Analysis Failed:\n${err.message}\n${JSON.stringify(err.response?.data || {})}`);
            setError(err.response?.data?.detail || "Analysis failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    console.log("DEBUG: ContentAnalysisModal OPENED", { isOpen, jobId, communityId, communityName });
    // Use inline rendering with very high z-index to ensure visibility over other modals (z=1000)
    if (!isOpen) return null;

    if (!jobId) {
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
                zIndex: 20000
            }}>
                <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger)', marginBottom: '0.5rem' }}>Error</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Analysis Job ID is missing. Please reload your dataset.</p>
                    <button onClick={onClose} className="secondary-button">Close</button>
                </div>
            </div>
        )
    }

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
            zIndex: 20000
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: '800px',
                maxHeight: '90vh',
                overflowY: 'auto', // Scroll entire card
                display: 'block',  // Simple block layout
                padding: '0',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>

                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(2, 6, 23, 0.5)'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>
                            Deep S3 Analysis: {communityName}
                        </h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {safeSelectedPaperIds.length > 0
                                ? `Analyzing ${safeSelectedPaperIds.length} selected papers`
                                : `Analyzing all ${preSelectedPapersCount} papers (with PDFs)`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '0.5rem'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">

                    {/* Tabs */}
                    {results && (
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 1rem' }}>
                            <button
                                style={{
                                    padding: '1rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: activeTab === 'configure' ? '2px solid var(--accent)' : '2px solid transparent',
                                    color: activeTab === 'configure' ? 'var(--accent)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    transition: 'color 0.2s'
                                }}
                                onClick={() => setActiveTab('configure')}
                            >
                                ▶ Configuration
                            </button>
                            <button
                                style={{
                                    padding: '1rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: activeTab === 'themes' ? '2px solid var(--accent)' : '2px solid transparent',
                                    color: activeTab === 'themes' ? 'var(--accent)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    transition: 'color 0.2s'
                                }}
                                onClick={() => setActiveTab('themes')}
                            >
                                📄 Themes ({results.themes?.length || 0})
                            </button>
                            <button
                                style={{
                                    padding: '1rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: activeTab === 'aspects' ? '2px solid var(--accent)' : '2px solid transparent',
                                    color: activeTab === 'aspects' ? 'var(--accent)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    transition: 'color 0.2s'
                                }}
                                onClick={() => setActiveTab('aspects')}
                            >
                                📊 Aspects ({results.aspects?.length || 0})
                            </button>
                        </div>
                    )}

                    <div
                        id="modal-content-scroll"
                        style={{
                            padding: '1.5rem',
                            backgroundColor: 'transparent'
                        }}>

                        {/* CONFIGURATION VIEW - WIZARD */}
                        {(activeTab === 'configure' || !results) && (
                            <div className="h-full flex flex-col">

                                {/* Step Indicator */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-lg font-semibold text-gray-200">
                                            {currentStep === 0 && "Step 1 of 3: Select Papers"}
                                            {currentStep === 1 && "Step 2 of 3: Choose Sections"}
                                            {currentStep === 2 && "Step 3 of 3: Configure Model"}
                                        </h3>
                                        <span className="text-sm text-gray-400">{currentStep + 1}/{totalSteps}</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Step Content */}
                                <div className="flex-1 overflow-y-auto">

                                    {/* STEP 0: Paper Selection */}
                                    {currentStep === 0 && (
                                        <div>
                                            <p className="text-sm text-gray-400 mb-4">
                                                Choose which papers to include in the analysis ({localSelectedIds.length} / {availablePapers.length} selected).
                                            </p>

                                            <div className="flex gap-2 mb-3">
                                                <button
                                                    className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
                                                    onClick={() => setLocalSelectedIds(availablePapers.map(p => p.id))}
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    className="px-3 py-1 rounded bg-gray-600 text-white hover:bg-gray-700 text-sm"
                                                    onClick={() => setLocalSelectedIds([])}
                                                >
                                                    Clear All
                                                </button>
                                            </div>

                                            <div className="max-h-96 overflow-y-auto bg-white/5 rounded border border-gray-600">
                                                {availablePapers.length === 0 ? (
                                                    <div className="p-4 text-center text-gray-500 text-sm">
                                                        No papers found for this community.
                                                    </div>
                                                ) : (
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-gray-800 text-gray-300 sticky top-0">
                                                            <tr>
                                                                <th className="p-2 w-8 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={localSelectedIds.length === availablePapers.length && availablePapers.length > 0}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setLocalSelectedIds(availablePapers.map(p => p.id));
                                                                            } else {
                                                                                setLocalSelectedIds([]);
                                                                            }
                                                                        }}
                                                                    />
                                                                </th>
                                                                <th className="p-2">Title</th>
                                                                <th className="p-2 w-20">Year</th>
                                                                <th className="p-2 w-20">Cites</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-700">
                                                            {availablePapers.map(paper => (
                                                                <tr key={paper.id} className="hover:bg-blue-900/20">
                                                                    <td className="p-2 text-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={localSelectedIds.includes(paper.id)}
                                                                            onChange={(e) => {
                                                                                if (e.target.checked) {
                                                                                    setLocalSelectedIds(prev => [...prev, paper.id]);
                                                                                } else {
                                                                                    setLocalSelectedIds(prev => prev.filter(id => id !== paper.id));
                                                                                }
                                                                            }}
                                                                        />
                                                                    </td>
                                                                    <td className="p-2 truncate max-w-[400px]" title={paper.title}>
                                                                        {paper.title}
                                                                    </td>
                                                                    <td className="p-2 text-gray-400">{paper.year || 'N/A'}</td>
                                                                    <td className="p-2 text-gray-400">{paper.citations}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 1: Section Selection */}
                                    {currentStep === 1 && (
                                        <div>
                                            <p className="text-sm text-gray-400 mb-4">
                                                Choose which parts of the papers to specifically analyze.
                                            </p>

                                            <div className="grid grid-cols-2 gap-3">
                                                {sectionsList.map(sec => (
                                                    <label key={sec.id} className="flex items-center gap-2 p-3 border border-gray-600 rounded cursor-pointer hover:bg-white/5">
                                                        <input
                                                            type="checkbox"
                                                            checked={focusSections[sec.id] || false}
                                                            onChange={(e) => setFocusSections({ ...focusSections, [sec.id]: e.target.checked })}
                                                            className="accent-blue-500"
                                                        />
                                                        <span className="text-sm text-gray-200">{sec.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 2: Model Configuration */}
                                    {currentStep === 2 && (
                                        <div className="space-y-4">
                                            <p className="text-sm text-gray-400 mb-4">
                                                Select the AI model to generate topic labels.
                                            </p>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Model Type</label>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => setModelType('gemini')}
                                                        className={`flex-1 p-3 rounded border ${modelType === 'gemini' ? 'border-blue-500 bg-blue-500/20' : 'border-gray-600'}`}
                                                    >
                                                        <div className="text-sm font-medium">Gemini</div>
                                                        <div className="text-xs text-gray-400">Google AI</div>
                                                    </button>
                                                    <button
                                                        onClick={() => setModelType('local')}
                                                        className={`flex-1 p-3 rounded border ${modelType === 'local' ? 'border-blue-500 bg-blue-500/20' : 'border-gray-600'}`}
                                                    >
                                                        <div className="text-sm font-medium">Local</div>
                                                        <div className="text-xs text-gray-400">Self-hosted</div>
                                                    </button>
                                                </div>
                                            </div>

                                            {modelType === 'gemini' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">Gemini API Key</label>
                                                    <input
                                                        type="password"
                                                        value={apiKey}
                                                        onChange={(e) => setApiKey(e.target.value)}
                                                        placeholder="Enter your API key..."
                                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-gray-200 text-sm"
                                                    />
                                                </div>
                                            )}

                                            {modelType === 'local' && (
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-300 mb-2">Model Name</label>
                                                        <input
                                                            type="text"
                                                            value={localModelName}
                                                            onChange={(e) => setLocalModelName(e.target.value)}
                                                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-gray-200 text-sm"
                                                        />
                                                    </div>
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={use8bit}
                                                            onChange={(e) => setUse8bit(e.target.checked)}
                                                            className="accent-blue-500"
                                                        />
                                                        <span className="text-sm text-gray-300">Use 8-bit quantization</span>
                                                    </label>
                                                </div>
                                            )}

                                            {/* Sentences Per Section Control */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Sentences Per Section: {sentencesPerSection}
                                                </label>
                                                <p className="text-xs text-gray-400 mb-2">
                                                    More sentences = more detailed analysis (recommended 8-12 for 2-5 PDFs)
                                                </p>
                                                <input
                                                    type="range"
                                                    min="4"
                                                    max="20"
                                                    value={sentencesPerSection}
                                                    onChange={(e) => setSentencesPerSection(parseInt(e.target.value))}
                                                    className="w-full accent-blue-500"
                                                />
                                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                    <span>4 (Fast)</span>
                                                    <span>12 (Balanced)</span>
                                                    <span>20 (Detailed)</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Navigation Buttons */}
                                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
                                    <button
                                        onClick={() => setCurrentStep(currentStep - 1)}
                                        disabled={currentStep === 0}
                                        className="px-4 py-2 rounded bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                                    >
                                        ← Previous
                                    </button>

                                    {error && (
                                        <p className="text-sm text-red-400">{error}</p>
                                    )}

                                    {currentStep < totalSteps - 1 ? (
                                        <button
                                            onClick={() => {
                                                // Validation
                                                if (currentStep === 0 && localSelectedIds.length === 0) {
                                                    setError("Please select at least one paper.");
                                                    return;
                                                }
                                                if (currentStep === 1 && Object.values(focusSections).every(v => !v)) {
                                                    setError("Please select at least one section.");
                                                    return;
                                                }
                                                setError(null);
                                                setCurrentStep(currentStep + 1);
                                            }}
                                            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                                        >
                                            Next →
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleRunAnalysis}
                                            disabled={loading}
                                            className="px-6 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                        >
                                            {loading ? "Analyzing..." : "🚀 Start Analysis"}
                                        </button>
                                    )}
                                </div>

                                {/* Progress Display (when loading) */}
                                {loading && processingStep && (
                                    <div className="mt-4 p-4 bg-gray-800 rounded">
                                        <div className="flex justify-between text-sm text-gray-300 font-medium mb-2">
                                            <span>{processingStep}</span>
                                            <span>{progressPercent}%</span>
                                        </div>
                                        <div className="w-full bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${progressPercent}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}


                        {/* THEMES RESULTS VIEW */}
                        {
                            results && activeTab === 'themes' && (
                                <div className="card" style={{ padding: 0, overflow: 'hidden', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                    {analysisStats && (
                                        <div style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--accent)', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--accent-soft)' }}>
                                            Analyzed {analysisStats.analyzed} out of {analysisStats.total} papers.
                                        </div>
                                    )}
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                            <thead style={{ backgroundColor: 'rgba(2, 6, 23, 0.4)' }}>
                                                <tr>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>No.</th>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Theme (Label)</th>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Size</th>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protoype Sentences</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(results.themes || []).map((theme, idx) => (
                                                    <tr key={idx} style={{ borderTop: '1px solid var(--border-subtle)' }} className="hover:bg-white/5">
                                                        <td style={{ padding: '1rem', color: 'var(--text-soft)' }}>
                                                            {idx + 1}
                                                        </td>
                                                        <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                            {theme.Theme}
                                                        </td>
                                                        <td style={{ padding: '1rem', color: 'var(--text-soft)' }}>
                                                            {theme.cluster_size}
                                                        </td>
                                                        <td style={{ padding: '1rem', color: 'var(--text-muted)', maxWidth: '400px' }}>
                                                            <div style={{
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 3,
                                                                WebkitBoxOrient: 'vertical',
                                                                overflow: 'hidden',
                                                                fontStyle: 'italic',
                                                                fontSize: '0.85rem'
                                                            }}>
                                                                "{theme.Prototype_Sents.substring(0, 300)}..."
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )
                        }

                        {/* ASPECTS RESULTS VIEW */}
                        {
                            results && activeTab === 'aspects' && (
                                <div className="card" style={{ padding: 0, overflow: 'hidden', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                            <thead style={{ backgroundColor: 'rgba(2, 6, 23, 0.4)' }}>
                                                <tr>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aspect</th>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sub-Themes</th>
                                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Count</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(results.aspects || []).map((aspect, idx) => (
                                                    <tr key={idx} style={{ borderTop: '1px solid var(--border-subtle)' }} className="hover:bg-white/5">
                                                        <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                                                            {aspect.Aspects}
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                                {(aspect.combined_topics || []).map((t, i) => (
                                                                    <span key={i} style={{
                                                                        padding: '0.2rem 0.5rem',
                                                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                                                        borderRadius: '999px',
                                                                        fontSize: '0.75rem',
                                                                        border: '1px solid var(--border-subtle)',
                                                                        color: 'var(--text-main)'
                                                                    }}>
                                                                        {t}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem', color: 'var(--text-soft)' }}>
                                                            {aspect.num_themes}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )
                        }
                    </div >
                </div >
            </div >
        </div >
    );
};
