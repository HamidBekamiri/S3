import React, { useState } from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  uploadAndAnalyzeCsv,
  generateTopicLabels,
  cleanInterdisciplinaryData,
  enhanceCitations,
  getInterdisciplinaryAnalysis,
  loadInnovationUsecase,
  loadEcosystemUsecase,
  loadMergersAcquisitionUsecase,
  loadCOOUsecase,
  type CsvAnalysisResult,
  API_BASE,
  assignOutlier,
} from "./api";
import CommunityMap from "./CommunityMap";
import OutlierTable from "./OutlierTable";
import CitationMatrix from "./CitationMatrix";
import KnowledgeTree from "./KnowledgeTree"; // Added import
// Google Auth removed

import ScopusInstructions from './ScopusInstructions';
import { AuthProvider, useAuth, type User } from './AuthContext';
import AdminDashboard from './AdminDashboard';
import CommunityPapersModal from './CommunityPapersModal';
import { ContentAnalysisModal } from './ContentAnalysisModal';
import PDFManagerModal from './PDFManagerModal';
import SubcommunityDendrogram from './SubcommunityDendrogram';
import axios from 'axios';


class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReset = () => {
    localStorage.removeItem("s3_csvResult");
    localStorage.removeItem("s3_csvResult_v2");
    localStorage.removeItem("s3_llmLabels");
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
          <h2>Something went wrong.</h2>
          <p style={{ color: "red" }}>{this.state.error?.message}</p>
          <button
            onClick={this.handleReset}
            style={{
              padding: "0.5rem 1rem",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "1rem"
            }}
          >
            Clear Data & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Google Client ID removed


// Pipeline stages we show in the UI
const CSV_STEPS = [
  "Loading CSV",
  "Computing embeddings",
  "Computing similarity matrix",
  "Scanning thresholds",
  "Building community graph",
  "Computing citation",
  "Computing year distribution",
  "Done",
];

function stepIndexFromStage(stage: string): number {
  const lower = (stage || "").toLowerCase();
  const idx = CSV_STEPS.findIndex((s) => lower.includes(s.toLowerCase()));
  return idx === -1 ? 0 : idx;
}

const StatPill: React.FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <div className="pill">
    <div className="pill-label">{label}</div>
    <div className="pill-value">{value}</div>
  </div>
);

import { COLORS } from "./constants";
import { fetchReferenceReport } from "./api";

const ReferenceReportSection: React.FC<{ filename?: string; jobId?: string }> = ({ filename, jobId }) => {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!filename) return;
    setLoading(true);
    fetchReferenceReport(filename)
      .then(data => {
        setReport(data.content);
      })
      .catch(() => {
        // It's expected to be 404 initially while processing
        setReport(null);
      })
      .finally(() => setLoading(false));
  }, [filename]);

  const isStandardUsecase = jobId?.startsWith("usecase_");

  // Debug logging
  React.useEffect(() => {
    console.log('[ReferenceReport] jobId:', jobId, 'isStandardUsecase:', isStandardUsecase, 'filename:', filename);
  }, [jobId, filename]);





  return (
    <div className="subsection">
      <details className="info-details">
        <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
          ℹ️ Reference Report
        </summary>
        <div className="info-content" style={{ marginTop: "0.5rem" }}>
          {!filename && (
            <div style={{ color: 'gray', fontStyle: 'italic' }}>
              {isStandardUsecase
                ? "Reference report not available for this legacy dataset."
                : "Upload a new CSV file to generate a reference report."
              }
            </div>
          )}

          {filename && loading && <div>Loading report...</div>}
          {filename && !loading && !report && (
            <div style={{ color: 'gray', fontStyle: 'italic' }}>
              Report is being generated or not yet available for this file.
            </div>
          )}
          {filename && report && (
            <pre style={{
              background: '#f8f9fa',
              padding: '1rem',
              borderRadius: '4px',
              overflowX: 'auto',
              fontSize: '0.85rem',
              border: '1px solid #e9ecef',
              whiteSpace: 'pre-wrap'
            }}>
              {report}
            </pre>
          )}
        </div>
      </details>
    </div>
  );
};




const CsvResultSummary: React.FC<{
  result: CsvAnalysisResult;
  llmLabels?: Record<number, string>;
  onCommunityClick: (communityId: number) => void;
}> = ({
  result,
  llmLabels = {},
  onCommunityClick,
}) => {
    const [topPapersPage, setTopPapersPage] = useState(0);
    const best = result.best_threshold_stats;

    // Defensive access to arrays
    const thresholdScan = result.threshold_scan || [];
    const communities = result.communities || [];
    const topCitedPapers = result.top_cited_papers || [];
    const yearDistribution = result.year_distribution || [];

    const fmt = (v: number | null | undefined, digits = 3) =>
      v === null || v === undefined ? "n/a" : v.toFixed(digits);

    return (
      <div className="csv-result">

        {/* NEW OVERVIEW CONTAINER */}
        <details className="info-details">
          <summary style={{ cursor: "pointer", fontWeight: 600, color: "#333", fontSize: "1.2rem", padding: "0.5rem 0" }}>
            📊 General Overview & Stats
          </summary>

          <div className="subsection" style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "1rem", background: "#fff", marginTop: "0.5rem" }}>

            {/* 1. Reference Report */}
            <ReferenceReportSection filename={result.filename} jobId={result.job_id} />

            {/* 2. Basic Stats (Papers/Years) */}
            <div className="subsection">
              <details className="info-details">
                <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                  ℹ️ Dataset Stats
                </summary>
                <div className="info-content" style={{ marginTop: "0.5rem" }}>
                  <div className="pill-row">
                    <StatPill label="Papers" value={result.n_papers} />
                    <StatPill
                      label="Years"
                      value={
                        result.year_min && result.year_max
                          ? `${result.year_min}–${result.year_max}`
                          : "n/a"
                      }
                    />
                    <StatPill label="Embedding dim" value={result.embedding_dim} />
                    <StatPill label="Truncated" value={result.truncated ? "Yes" : "No"} />
                  </div>

                </div>
              </details>
            </div>

            {/* 3. S3 Stats */}
            <div className="subsection">
              <details className="info-details">
                <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                  ℹ️ S3 (Similarity) stats
                </summary>
                <div className="info-content" style={{ marginTop: "0.5rem" }}>
                  <div className="pill-row">
                    <StatPill label="Min" value={fmt(result.s3_stats?.min)} />
                    <StatPill label="Max" value={fmt(result.s3_stats?.max)} />
                    <StatPill label="Mean" value={fmt(result.s3_stats?.mean)} />
                  </div>
                </div>
              </details>
            </div>

            {/* 4. Threshold Scan */}
            <div className="subsection">
              <details className="info-details">
                <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                  ℹ️ Threshold scan
                </summary>
                <div className="info-content" style={{ marginTop: "0.5rem" }}>
                  {best && (
                    <div className="pill-row">
                      <StatPill label="Best threshold" value={best.threshold} />
                      <StatPill label="Silhouette" value={fmt(best.silhouette)} />
                      <StatPill label="Included papers" value={best.n_papers} />
                      {result.optimal_k_elbow && (
                        <StatPill label="Optimal Communities (Elbow)" value={result.optimal_k_elbow} />
                      )}
                    </div>
                  )}
                  <div className="table-wrapper">
                    <table className="table small">
                      <thead>
                        <tr>
                          <th>Threshold</th>
                          <th>Silhouette</th>
                          <th>Included papers (clusters)</th>
                          <th>Excluded papers (singletons)</th>
                          <th>Communities (Total)</th>
                          <th>Groups (&gt;1)</th>
                          <th>Modularity</th>
                          <th>SII</th>
                        </tr>
                      </thead>
                      <tbody>
                        {thresholdScan.slice(0, 12).map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.threshold.toFixed(2)}</td>
                            <td>{row.silhouette.toFixed(3)}</td>
                            <td>{row.n_papers}</td>
                            <td>{(result.n_papers || 0) - row.n_papers}</td>
                            <td>{row.n_communities ?? "-"}</td>
                            <td>{(row.n_communities && result.n_papers) ? (row.n_communities - ((result.n_papers || 0) - row.n_papers)) : "-"}</td>
                            <td>{row.modularity ? row.modularity.toFixed(3) : "-"}</td>
                            <td>{row.sii.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {thresholdScan.length > 12 && (
                      <div className="table-note">
                        Showing first 12 rows of {thresholdScan.length}.
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>

            {/* 5. Top Cited Papers */}
            <div className="subsection">
              <details className="info-details">
                <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                  ℹ️ Top cited papers
                </summary>
                <div className="info-content" style={{ marginTop: "0.5rem" }}>


                  <div className="table-wrapper">
                    <table className="table small">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Year</th>
                          <th>Global Cites</th>
                          <th>Local Cites</th>
                          <th>Community</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Filter top papers by community size > 2
                          const validCommIds = new Set(
                            communities
                              .filter(c => c && c.n_papers > 2)
                              .map(c => c.id)
                          );

                          const topPapers = topCitedPapers
                            .filter(p => p && p.community !== null && p.community !== undefined && validCommIds.has(p.community))
                            .slice(0, 50);

                          const pageSize = 10;
                          // Ensure page is valid
                          const safePage = topPapers.length > 0
                            ? Math.min(topPapersPage, Math.floor((topPapers.length - 1) / pageSize))
                            : 0;
                          const pageData = topPapers.slice(safePage * pageSize, (safePage + 1) * pageSize);

                          return pageData.map((p, idx) => (
                            <tr key={idx}>
                              <td className="td-title">{p.title}</td>
                              <td>{p.year ?? "n/a"}</td>
                              <td>{p.cited_by}</td>
                              <td>{p.local_citations ?? "0"}</td>
                              <td>
                                {p.community !== null && p.community !== undefined ? (
                                  <div
                                    style={{ cursor: "pointer" }}
                                    onClick={() => onCommunityClick(p.community!)}
                                  >
                                    <strong style={{ textDecoration: "underline", color: "var(--accent)" }}>{p.community + 1}</strong>
                                    {llmLabels[p.community] && (
                                      <>
                                        <br />
                                        <span style={{ fontSize: "0.85em", color: "var(--accent)" }}>
                                          {llmLabels[p.community]}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  "–"
                                )}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                    {topCitedPapers.length > 10 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                        <div className="table-note">
                          Showing {topPapersPage * 10 + 1}–{Math.min((topPapersPage + 1) * 10, 50)} of 50
                        </div>
                        <div>
                          <button
                            onClick={() => setTopPapersPage(prev => Math.max(0, prev - 1))}
                            disabled={topPapersPage === 0}
                            style={{ marginRight: "0.5rem", padding: "2px 8px", cursor: "pointer" }}
                          >
                            Prev
                          </button>
                          <button
                            onClick={() => setTopPapersPage(prev => prev + 1)}
                            disabled={(topPapersPage + 1) * 10 >= 50}
                            style={{ padding: "2px 8px", cursor: "pointer" }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>

            {/* 6. Year Distribution */}
            <div className="subsection">
              <details className="info-details">
                <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                  ℹ️ Year distribution
                </summary>
                <div className="info-content" style={{ marginTop: "0.5rem" }}>
                  <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={yearDistribution}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#82ca9d" name="Papers" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </details>
            </div>

          </div>
        </details>
        {/* END OVERVIEW CONTAINER */}

      </div >
    );
  };

const ValidationPaperTable: React.FC<{
  papers: any[],
  title: string,
  errorType: "FP" | "FN"
}> = ({ papers, title, errorType }) => {
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(papers.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, papers.length);
  const visiblePapers = papers.slice(startIndex, endIndex);

  const isFP = errorType === "FP";
  const badgeColor = isFP ? "#ffc107" : "#dc3545";
  const badgeTextColor = isFP ? "#000" : "#fff";
  const borderColor = isFP ? "#ffeeba" : "#f5c6cb";

  if (!papers || papers.length === 0) return null;

  return (
    <div style={{ background: "#fff", padding: "1rem", borderRadius: "8px", border: `1px solid ${borderColor}`, marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ background: badgeColor, color: badgeTextColor, padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>
            {isFP ? "TYPE 1 ERROR" : "TYPE 2 ERROR"}
          </span>
          <strong style={{ fontSize: "0.9rem" }}>{title}</strong>
          <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '0.5rem' }}>
            (Showing {startIndex + 1}-{endIndex} of {papers.length})
          </span>
        </div>
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button className="btn btn-sm btn-light" style={{ padding: "0 8px" }} onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>←</button>
            <span style={{ fontSize: "0.7rem" }}>Page {currentPage + 1} of {totalPages}</span>
            <button className="btn btn-sm btn-light" style={{ padding: "0 8px" }} onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}>→</button>
          </div>
        )}
      </div>

      <table className="table table-sm" style={{ width: "100%", margin: 0, fontSize: "0.8rem" }}>
        <thead>
          <tr style={{ background: "#f8f9fa" }}>
            <th style={{ width: "30px" }}></th>
            <th>Title</th>
            <th style={{ width: "50px", textAlign: "center" }}>Year</th>
            <th style={{ width: "50px", textAlign: "center" }}>Cites</th>
            <th style={{ width: "60px", textAlign: "center", fontSize: "0.75rem" }}>BC Score</th>
            <th style={{ width: "60px", textAlign: "center", fontSize: "0.75rem" }}>CC Score</th>
          </tr>
        </thead>
        <tbody>
          {visiblePapers.map((p) => (
            <React.Fragment key={p.eid}>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ cursor: "pointer", textAlign: "center" }} onClick={() => setExpandedRow(expandedRow === p.eid ? null : p.eid)}>
                  {expandedRow === p.eid ? "▼" : "▶"}
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: "#0066cc", cursor: "pointer" }} onClick={() => setExpandedRow(expandedRow === p.eid ? null : p.eid)}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>{p.authors}</div>
                </td>
                <td style={{ textAlign: "center", verticalAlign: "middle" }}>{p.year || "-"}</td>
                <td style={{ textAlign: "center", verticalAlign: "middle" }}>{p.citations || 0}</td>
                <td style={{ textAlign: "center", verticalAlign: "middle", fontWeight: "bold", color: "#666" }}>{p.bc_score ?? "-"}</td>
                <td style={{ textAlign: "center", verticalAlign: "middle", fontWeight: "bold", color: "#666" }}>{p.cc_score ?? "-"}</td>
              </tr>
              {expandedRow === p.eid && (
                <tr style={{ background: "#fcfcfc" }}>
                  <td colSpan={6} style={{ padding: "0.8rem 1rem", borderBottom: "1px solid #eee" }}>
                    <div style={{ fontSize: "0.8rem", lineHeight: "1.5" }}>
                      <strong>Abstract:</strong>
                      <p style={{ margin: "5px 0 0 0", color: "#444" }}>{p.abstract || "No abstract available."}</p>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const MethodComparison: React.FC<{ result: CsvAnalysisResult }> = ({ result }) => {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  if (!result.method_comparison && !result.co_citation && (!result.validation_stats || result.validation_stats.length === 0)) return null;

  const renderMatrix = (matrix: number[][] = [], title: string, note: string, methods: string[] = []) => (
    <div style={{ marginBottom: "1rem" }}>
      <h5>{title}</h5>
      <div style={{ overflowX: "auto" }}>
        <table className="table small" style={{ tableLayout: "fixed", width: "auto" }}>
          <thead>
            <tr>
              <th style={{ width: 150 }}>Method</th>
              {methods.map((m, i) => (
                <th key={i} style={{ textAlign: "center", width: 80, fontSize: "0.7rem" }}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td style={{ textAlign: "right", paddingRight: 8, fontWeight: 500 }}>{methods[i]}</td>
                {row.map((val, j) => {
                  const intensity = val; // 0-1
                  const bg = `rgba(0, 128, 0, ${0.1 + 0.9 * intensity})`;
                  const fg = intensity > 0.5 ? "#fff" : "#000";
                  return (
                    <td
                      key={j}
                      style={{
                        backgroundColor: val > 0 ? bg : "transparent",
                        color: val > 0 ? fg : "#ccc",
                        textAlign: "center",
                        fontSize: "0.8rem",
                      }}
                    >
                      {val.toFixed(3)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-note">{note}</div>
      </div>
    </div>
  );

  return (
    <div className="subsection">
      <details className="info-details" open>
        <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
          ℹ️ Method Comparison (Bibliometric)
        </summary>
        <div className="info-content" style={{ marginTop: "0.5rem" }}>

          {result.method_comparison && (
            <>
              <p className="small text-muted">
                Comparing the S3 (Semantic) approach with standard bibliometric methods.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
                {renderMatrix(
                  result.method_comparison.correlation_matrix,
                  "Matrix Correlation (Pearson)",
                  "Correlation between the similarity values of different methods.",
                  result.method_comparison.methods
                )}
                {renderMatrix(
                  result.method_comparison.overlap_matrix,
                  "Top-10 Neighbor Overlap (Jaccard)",
                  "Average overlap of top-10 similar papers for each paper.",
                  result.method_comparison.methods
                )}
              </div>
            </>
          )}

          {result.validation_stats && result.validation_stats.length > 0 && (
            <div style={{ marginTop: "2rem", borderTop: "1px solid #eee", paddingTop: "1rem" }}>
              <h5>Comparative Validation (Community Detection vs S3)</h5>
              <p className="small text-muted">
                Comparing communities detected by Bibliographic Coupling (BC) and In-Corpus Co-citation (CC) against the S3 "Relevant" (in-community) papers.
                High TP/Recall indicates the method finds the same papers as S3.
              </p>
              <div style={{ color: "red", fontSize: "0.8rem", padding: "10px", background: "#f0f0f0", marginBottom: "10px", border: "1px dashed red" }}>
                <strong>DEBUG DATA CHECK:</strong><br />
                First Method: {result.validation_stats[0].method}<br />
                First FP Paper BC Score: {JSON.stringify(result.validation_stats[0].FP_papers?.[0]?.bc_score)}<br />
                First FP Paper CC Score: {JSON.stringify(result.validation_stats[0].FP_papers?.[0]?.cc_score)}
              </div>
              <table className="table small table-bordered" style={{ width: "100%", marginTop: "1rem" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa" }}>
                    <th>Method</th>
                    <th style={{ textAlign: "center" }}>Edge Thr.</th>
                    <th style={{ textAlign: "center" }}>Precision</th>
                    <th style={{ textAlign: "center" }}>Recall</th>
                    <th style={{ textAlign: "center" }}>F1 Score</th>
                    <th style={{ textAlign: "center" }}>TP</th>
                    <th style={{ textAlign: "center" }}>FP (Type 1)</th>
                    <th style={{ textAlign: "center" }}>FN (Type 2)</th>
                    <th style={{ textAlign: "center" }}>TN</th>
                  </tr>
                </thead>
                <tbody>
                  {result.validation_stats.map((stat, i) => (
                    <React.Fragment key={i}>
                      <tr
                        style={{ cursor: "pointer", background: expandedIndex === i ? "#fffdf5" : "inherit" }}
                        onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                      >
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            {expandedIndex === i ? "▼" : "▶"}
                            <strong>{stat.method}</strong>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>{stat.edge_threshold}</td>
                        <td style={{ textAlign: "center" }}>{(stat.Precision * 100).toFixed(1)}%</td>
                        <td style={{ textAlign: "center" }}>{(stat.Recall * 100).toFixed(1)}%</td>
                        <td style={{ textAlign: "center" }}>{(stat.F1 * 100).toFixed(1)}%</td>
                        <td style={{ textAlign: "center" }} className="text-success">{stat.TP}</td>
                        <td style={{ textAlign: "center", fontWeight: "bold" }} className="text-warning">
                          {stat.FP}
                          <div style={{ fontSize: "0.65rem", fontWeight: "normal" }}>Type 1 Error</div>
                        </td>
                        <td style={{ textAlign: "center", fontWeight: "bold" }} className="text-danger">
                          {stat.FN}
                          <div style={{ fontSize: "0.65rem", fontWeight: "normal" }}>Type 2 Error</div>
                        </td>
                        <td style={{ textAlign: "center" }} className="text-muted">{stat.TN}</td>
                      </tr>
                      {expandedIndex === i && ((stat.FP_papers && stat.FP_papers.length > 0) || (stat.FN_papers && stat.FN_papers.length > 0)) && (
                        <tr>
                          <td colSpan={9} style={{ padding: "1rem", background: "#fffdf5", borderTop: "none" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                              <ValidationPaperTable
                                papers={stat.FP_papers || []}
                                title={`FP Reduction (Reduced Noise)`}
                                errorType="FP"
                              />
                              <ValidationPaperTable
                                papers={stat.FN_papers || []}
                                title={`FN Reduction (Increased Signal)`}
                                errorType="FN"
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {result.validation_pairwise && result.validation_pairwise.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                  <p className="small text-muted" style={{ marginBottom: "0.5rem" }}><strong>Pairwise Partition Agreement:</strong> Measures how often pairs of papers are correctly clustered together compared to S3.</p>
                  <table className="table small" style={{ width: "auto" }}>
                    <thead><tr><th>Method</th><th>Pair Precision</th><th>Pair Recall</th><th>Pair F1</th></tr></thead>
                    <tbody>
                      {result.validation_pairwise.map((p, idx) => (
                        <tr key={idx}>
                          <td>{p.method}</td>
                          <td>{(p.pair_precision * 100).toFixed(1)}%</td>
                          <td>{(p.pair_recall * 100).toFixed(1)}%</td>
                          <td>{(p.pair_f1 * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </details>
    </div>
  );
};

const CommunitiesOverview: React.FC<{
  result: CsvAnalysisResult;
  llmLabels: Record<number, string>;
}> = ({ result, llmLabels }) => {
  const [numCommunities, setNumCommunities] = useState(20);
  const [numWordclouds, setNumWordclouds] = useState(10);

  // Transform community data to include topic labels
  const communityDataWithLabels = React.useMemo(() => {
    return (result.communities || []).slice(0, numCommunities).map(comm => ({
      ...comm,
      displayLabel: llmLabels[comm.id] || `Community ${comm.id + 1}`,
      topicLabel: llmLabels[comm.id] || ""
    }));
  }, [result.communities, llmLabels, numCommunities]);

  // Sub-community Analysis State
  const [selectedCommunities, setSelectedCommunities] = useState<number[]>([]);

  const toggleCommunitySelection = (id: number) => {
    setSelectedCommunities(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          border: "1px solid #ccc",
          borderRadius: "4px",
          padding: "8px 12px",
          fontSize: "0.85rem"
        }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>
            Community {data.id + 1} - {data.displayLabel}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "4px" }}>
            {selectedCommunities.includes(data.id) ? "✅ Selected for Sub-analysis" : "Click bar to select"}
          </div>
          <div style={{ color: "#333", marginTop: "4px" }}>
            Papers: <strong>{data.n_papers}</strong>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="csv-result">
      <MethodComparison result={result} />
      <div className="subsection">
        <div className="pill-row">
          <StatPill label="Communities" value={(result.communities || []).length} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "auto" }}>
            <label htmlFor="comm-slider" style={{ fontSize: "0.85rem", color: "#555" }}>
              Show top {numCommunities}
            </label>
            <input
              id="comm-slider"
              type="range"
              min="5"
              max={Math.min(50, (result.communities || []).length)}
              step="5"
              value={numCommunities}
              onChange={(e) => setNumCommunities(parseInt(e.target.value))}
              style={{ cursor: "pointer", width: "100px" }}
            />
          </div>
          <StatPill
            label="Total community citations"
            value={result.total_field_citations}
          />
        </div>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={communityDataWithLabels}
              margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="displayLabel"
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 11 }}
                label={{ value: "Community / Topic", position: "insideBottom", offset: -50 }}
              />
              <YAxis label={{ value: "Papers", angle: -90, position: "insideLeft" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="n_papers"
                fill="#8884d8"
                name="Papers"
                onClick={(data: any) => toggleCommunitySelection(Number(data.id))}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>


        {/* Subcommunity Hierarchy Dendrogram */}
        <SubcommunityDendrogram
          communities={result.communities}
          llmLabels={llmLabels}
          paperNetwork={result.paper_network}
          selectedCommunities={new Set(selectedCommunities)}
          onSelectionChange={(newSet) => setSelectedCommunities(Array.from(newSet))}
        />

        {(result.communities || []).length > numCommunities && (
          <div className="table-note" style={{ marginTop: "1rem" }}>
            Showing top {numCommunities} of {(result.communities || []).length} communities by size.
          </div>
        )}

        <details className="info-details" style={{ marginTop: "1rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
            ℹ️ Similarity Graph Insights (Node & Graph Level)
          </summary>
          <div className="info-content" style={{ marginTop: "0.5rem", fontSize: "0.9rem", lineHeight: "1.5", color: "var(--text-soft)" }}>
            {result.graph_insights ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  <div style={{ background: "#f5f5f5", padding: "0.5rem", borderRadius: "4px" }}>
                    <strong>Modularity:</strong> {result.graph_insights.modularity.toFixed(3)}
                    <div style={{ fontSize: "0.8em", color: "#666" }}>High (&gt;0.4) = clear sub-disciplines</div>
                  </div>
                  <div style={{ background: "#f5f5f5", padding: "0.5rem", borderRadius: "4px" }}>
                    <strong>Global Density:</strong> {result.graph_insights.global_density.toFixed(4)}
                    <div style={{ fontSize: "0.8em", color: "#666" }}>High = integrated field</div>
                  </div>
                </div>

                <h4>1. Node-level indicators (Top Papers)</h4>

                <div style={{ marginBottom: "1rem" }}>
                  <strong>High Degree (Topic Anchors):</strong>
                  <ul style={{ paddingLeft: "1.2rem", margin: "0.5rem 0" }}>
                    {result.graph_insights.top_degree.slice(0, 3).map((p) => (
                      <li key={p.id}>
                        "{p.title.substring(0, 60)}..." (Score: {p.score.toFixed(3)}, Comm: {p.community + 1})
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <strong>Eigenvector Centrality (Influential Cores):</strong>
                  <ul style={{ paddingLeft: "1.2rem", margin: "0.5rem 0" }}>
                    {result.graph_insights.top_eigenvector.slice(0, 3).map((p) => (
                      <li key={p.id}>
                        "{p.title.substring(0, 60)}..." (Score: {p.score.toFixed(3)}, Comm: {p.community + 1})
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginBottom: "0" }}>
                  <strong>Betweenness Centrality (Bridging Papers):</strong>
                  <ul style={{ paddingLeft: "1.2rem", margin: "0.5rem 0" }}>
                    {result.graph_insights.top_betweenness.slice(0, 3).map((p) => (
                      <li key={p.id}>
                        "{p.title.substring(0, 60)}..." (Score: {p.score.toFixed(3)}, Comm: {p.community + 1})
                      </li>

                    ))}
                  </ul>
                </div>

                {result.graph_insights.similarity_matrix && (
                  <div style={{ marginTop: "1rem" }}>
                    <h4>3. Confusion Matrix of Similarity (Top 10 Communities)</h4>
                    <div style={{ overflowX: "auto" }}>
                      <table className="table small" style={{ tableLayout: "fixed", width: "auto" }}>
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}></th>
                            {result.graph_insights.similarity_matrix.community_ids.map((id) => (
                              <th key={id} style={{ textAlign: "center", width: 40 }}>
                                {id + 1}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.graph_insights.similarity_matrix.matrix.map((row, i) => (
                            <tr key={result.graph_insights.similarity_matrix!.community_ids[i]}>
                              <th style={{ textAlign: "right", paddingRight: 8 }}>
                                {result.graph_insights.similarity_matrix!.community_ids[i] + 1}
                              </th>
                              {row.map((val, j) => {
                                // Dynamic coloring based on value
                                // Assuming max similarity is around 1.0, but let's normalize by row max or global max if possible
                                // For simplicity, let's use a fixed scale 0-1
                                const intensity = Math.min(1.0, val);
                                const bg = `rgba(0, 128, 0, ${0.1 + 0.9 * intensity})`; // Green scale
                                const fg = intensity > 0.5 ? "#fff" : "#000";
                                return (
                                  <td
                                    key={result.graph_insights.similarity_matrix!.community_ids[j]}
                                    style={{
                                      backgroundColor: val > 0 ? bg : "transparent",
                                      color: val > 0 ? fg : "#ccc",
                                      textAlign: "center",
                                      border: "1px solid #eee",
                                      fontSize: "0.8rem"
                                    }}
                                    title={`Avg Sim: ${val.toFixed(3)}`}
                                  >
                                    {val > 0 ? val.toFixed(2) : ""}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="table-note">
                        Average edge weight (similarity) between communities.
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Temporal Patterns (Global) */}
                {result.graph_insights.year_distribution && (result.graph_insights.year_distribution || []).length > 0 && (
                  <div style={{ marginTop: "1rem" }}>
                    <h4>3. Temporal Patterns (Global)</h4>
                    <div style={{ height: 300, width: "100%" }}>
                      <ResponsiveContainer>
                        <LineChart
                          data={result.graph_insights.year_distribution}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" />
                          <YAxis label={{ value: 'Papers', angle: -90, position: 'insideLeft' }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} strokeWidth={2} name="Papers" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="table-note">
                      Evolution of publication volume over time.
                    </div>
                  </div>
                )}

                {/* 4. Word Evolution (Top 10 Words) */}
                {result.graph_insights.word_evolution && (result.graph_insights.word_evolution || []).length > 0 && (
                  <div style={{ marginTop: "1rem" }}>
                    <h4>4. Word Evolution (Top 10 Words)</h4>
                    <div style={{ height: 300, width: "100%" }}>
                      <ResponsiveContainer>
                        <LineChart
                          data={(() => {
                            // Transform data for Recharts
                            const allYears = new Set<number>();
                            result.graph_insights.word_evolution!.forEach(we => {
                              we.distribution.forEach(d => allYears.add(d.year));
                            });
                            const sortedYears = Array.from(allYears).sort((a, b) => a - b);

                            return sortedYears.map(year => {
                              const point: any = { year };
                              result.graph_insights.word_evolution!.forEach(we => {
                                const d = we.distribution.find(x => x.year === year);
                                point[we.word] = d ? d.count : 0;
                              });
                              return point;
                            });
                          })()}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" />
                          <YAxis label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }} />
                          <Tooltip />
                          <Legend />
                          {result.graph_insights.word_evolution.map((we, index) => (
                            <Line
                              key={we.word}
                              type="monotone"
                              dataKey={we.word}
                              stroke={["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#a4de6c", "#d0ed57"][index % 10]}
                              dot={false}
                              strokeWidth={2}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="table-note">
                      Growth of top keywords over time.
                    </div>
                  </div>
                )}

                {/* 5. Author RFI Section */}
                {result.graph_insights.author_rfi && (
                  <div style={{ marginTop: "1rem" }}>
                    <h4>5. Author Analysis (RFI)</h4>
                    <p style={{ fontSize: "0.9em", color: "#666" }}>
                      Authors are ranked by RFI Composite Score (Recency + Frequency + Impact).
                      Each dimension is scored 1-5 (quintiles). Higher is better.
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      {/* Global Top 10 */}
                      <div>
                        <h5>Global Top 10 Authors</h5>
                        <div className="table-wrapper">
                          <table className="table small" style={{ width: "100%" }}>
                            <thead>
                              <tr>
                                <th>Author</th>
                                <th>R (Year)</th>
                                <th>F (Count)</th>
                                <th>I (Cites)</th>
                                <th>Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.graph_insights.author_rfi.global_top_10.map((a, i) => (
                                <tr key={i}>
                                  <td title={a.author} style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.author}</td>
                                  <td>{a.last_year || "-"} <small>({a.R_score})</small></td>
                                  <td>{a.F_raw} <small>({a.F_score})</small></td>
                                  <td>{a.I_raw} <small>({a.I_score})</small></td>
                                  <td><strong>{a.total_score}</strong></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Per Community Top 5 */}
                      <div>
                        <h5>Top Authors per Community (Top 10 Communities)</h5>
                        <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #eee", padding: "0.5rem" }}>
                          {result.graph_insights.author_rfi.community_top_5.map((comm) => (
                            <div key={comm.community} style={{ marginBottom: "1rem" }}>
                              <h6 style={{ margin: "0.5rem 0", fontWeight: 600, color: "#333" }}>Community {comm.community + 1}</h6>
                              <table className="table small" style={{ width: "100%", fontSize: "0.8rem" }}>
                                <thead>
                                  <tr>
                                    <th>Author</th>
                                    <th>Score</th>
                                    <th>Details (R/F/I)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {comm.authors.map((a, j) => (
                                    <tr key={j}>
                                      <td style={{ maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.author}>{a.author}</td>
                                      <td><strong>{a.total_score}</strong></td>
                                      <td>{a.R_score}/{a.F_score}/{a.I_score} ({a.last_year})</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Community Content Analysis (Wordclouds) */}
                {result.community_wordcloud_top_terms && (result.community_wordcloud_top_terms || []).length > 0 && (
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <h4>6. Community Content Analysis</h4>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <label htmlFor="wc-slider" style={{ fontSize: "0.9rem", color: "#555" }}>
                          Show top {numWordclouds} communities
                        </label>
                        <input
                          id="wc-slider"
                          type="range"
                          min="1"
                          max={Math.min(50, (result.community_wordcloud_top_terms || []).length)}
                          value={numWordclouds}
                          onChange={(e) => setNumWordclouds(parseInt(e.target.value))}
                          style={{ cursor: "pointer" }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                      {(result.community_wordcloud_top_terms || []).slice(0, numWordclouds).map((c) => {
                        const keywordData = result.graph_insights.community_keyword_top_terms?.find(k => k.community === c.community);

                        return (
                          <div key={c.community} style={{ flex: "1 1 45%", border: "1px solid #eee", padding: "1rem", borderRadius: "8px" }}>
                            <h5 style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                              Community {c.community + 1}
                              {llmLabels[c.community] ? `: ${llmLabels[c.community]}` : ""}
                            </h5>

                            <div style={{ display: "flex", gap: "1rem" }}>
                              {/* TF-IDF Wordcloud */}
                              <div style={{ flex: 1 }}>
                                <h6 style={{ textAlign: "center", fontSize: "0.8rem", color: "#666" }}>TF-IDF Terms</h6>
                                <div style={{ height: 200, position: "relative" }}>
                                  <TagCloud terms={c.terms} />
                                </div>
                              </div>

                              {/* Keyword Wordcloud */}
                              {keywordData && keywordData.terms.length > 0 && (
                                <div style={{ flex: 1, borderLeft: "1px solid #eee", paddingLeft: "1rem" }}>
                                  <h6 style={{ textAlign: "center", fontSize: "0.8rem", color: "#666" }}>Author Keywords</h6>
                                  <div style={{ height: 200, position: "relative" }}>
                                    <TagCloud terms={keywordData.terms} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="table-note">
                      Top terms for each community based on TF-IDF (left) and Author Keywords (right).
                    </div>
                  </div>
                )}

                {result.graph_insights.topic_evolution && (
                  <div style={{ marginTop: "1rem" }}>
                    <h4>7. Topic Evolution & Ranking</h4>

                    {/* 1. Ranking Table (Latest Window) */}
                    {(() => {
                      const te = result.graph_insights.topic_evolution!;
                      const windows = te.windows || [];
                      const lastWindow = windows.length > 0 ? windows[windows.length - 1] : undefined;
                      if (!lastWindow) return null; // Safety check

                      const lastTopics = (te.topics || [])
                        .filter(t => t.window_idx === (windows.length - 1))
                        .sort((a, b) => b.rank_score - a.rank_score)
                        .slice(0, 5);

                      return (
                        <div style={{ marginBottom: "1rem" }}>
                          <h5>Top Topics in Latest Window ({lastWindow.label})</h5>
                          <div className="table-wrapper">
                            <table className="table small" style={{ width: "100%" }}>
                              <thead>
                                <tr>
                                  <th>Topic ID</th>
                                  <th>Size</th>
                                  <th>Citations (Est)</th>
                                  <th>Sem. Centrality</th>
                                  <th>Rank Score</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lastTopics.map(t => {
                                  // Determine status (Emerging if high rank but small size? Or just placeholder)
                                  // For now, simple logic: Emerging if size < avg but rank is high?
                                  // Let's just use "Active" for now as we don't have historical growth calc in frontend yet
                                  return (
                                    <tr key={t.topic_id}>
                                      <td>{t.topic_id + 1}</td>
                                      <td>{t.size}</td>
                                      <td>{t.citations}</td>
                                      <td>{t.centrality.toFixed(3)}</td>
                                      <td>{t.rank_score.toFixed(2)}</td>
                                      <td>Active</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 2. Evolution Events */}
                    {(result.graph_insights.topic_evolution.events || []).length > 0 ? (
                      <div>
                        <h5>Significant Evolution Events</h5>
                        <ul className="list-disc pl-5">
                          {result.graph_insights.topic_evolution.events.map((e, i) => (
                            <li key={i} className="text-sm">
                              <strong>{e.window}</strong>: <span className={e.type === "merge" ? "text-blue-600" : "text-orange-600"}>{e.type.toUpperCase()}</span> - {e.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No merge/split events detected.</div>
                    )}
                  </div>
                )}


                {result.graph_insights.author_topic_network && (
                  <div style={{ marginTop: "1rem" }}>
                    <h4>8. Bipartite and Knowledge Graph</h4>
                    <div style={{ marginBottom: "1rem" }}>
                      <h5>Author-Topic Matrix (Top 20 Authors by Citations x Top Communities)</h5>
                      <div style={{ overflowX: "auto" }}>
                        <table className="table small" style={{ tableLayout: "fixed", width: "auto" }}>
                          <thead>
                            <tr>
                              <th style={{ width: 150 }}>Author</th>
                              {(result.graph_insights.author_topic_network.top_communities || []).map((id) => (
                                <th key={id} style={{ textAlign: "center", width: 40 }}>
                                  C{id + 1}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(result.graph_insights.author_topic_network.matrix || []).map((row, i) => (
                              <tr key={i}>
                                <td style={{ textAlign: "right", paddingRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.author}>
                                  {row.author}
                                </td>
                                {row.counts.map((val, j) => {
                                  // Heatmap coloring
                                  const maxVal = Math.max(...result.graph_insights.author_topic_network!.matrix.map(r => Math.max(...r.counts)));
                                  const intensity = maxVal > 0 ? val / maxVal : 0;
                                  const bg = `rgba(0, 128, 128, ${0.1 + 0.9 * intensity})`; // Teal scale
                                  const fg = intensity > 0.5 ? "#fff" : "#000";

                                  return (
                                    <td
                                      key={j}
                                      style={{
                                        backgroundColor: val > 0 ? bg : "transparent",
                                        color: val > 0 ? fg : "#ccc",
                                        textAlign: "center",
                                        border: "1px solid #eee",
                                        fontSize: "0.8rem"
                                      }}
                                      title={`${row.author} has ${val} citations in Community ${result.graph_insights.author_topic_network!.top_communities[j] + 1}`}
                                    >
                                      {val > 0 ? val : ""}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="table-note">
                          Total citations received by each author in the top communities.
                        </div>
                      </div>
                    </div>

                    {/* Projections */}
                    {result.graph_insights.author_topic_network.author_projection && (
                      <div style={{ marginBottom: "1rem" }}>
                        <h5>Author-Author Projection (Shared Topic Impact)</h5>
                        <div style={{ overflowX: "auto" }}>
                          <table className="table small" style={{ tableLayout: "fixed", width: "auto" }}>
                            <thead>
                              <tr>
                                <th style={{ width: 150 }}>Author</th>
                                {result.graph_insights.author_topic_network.top_authors.map((auth, idx) => (
                                  <th key={idx} style={{ textAlign: "center", width: 40, fontSize: "0.7rem", overflow: "hidden", textOverflow: "ellipsis" }} title={auth}>
                                    {idx + 1}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {result.graph_insights.author_topic_network.author_projection.map((row, i) => (
                                <tr key={i}>
                                  <td style={{ textAlign: "right", paddingRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={result.graph_insights.author_topic_network!.top_authors[i]}>
                                    {result.graph_insights.author_topic_network!.top_authors[i]}
                                  </td>
                                  {row.map((val, j) => {
                                    const maxVal = Math.max(...result.graph_insights.author_topic_network!.author_projection!.flat());
                                    const intensity = maxVal > 0 ? val / maxVal : 0;
                                    const bg = `rgba(128, 0, 128, ${0.1 + 0.9 * intensity})`; // Purple scale
                                    const fg = intensity > 0.5 ? "#fff" : "#000";
                                    return (
                                      <td key={j} style={{ backgroundColor: val > 0 ? bg : "transparent", color: val > 0 ? fg : "#ccc", textAlign: "center", fontSize: "0.7rem" }} title={`Similarity: ${val}`}>
                                        {val > 0 ? Math.round(val) : ""}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {result.graph_insights.author_topic_network.topic_projection && (
                      <div style={{ marginBottom: "1rem" }}>
                        <h5>Topic-Topic Projection (Shared Author Impact)</h5>
                        <div style={{ overflowX: "auto" }}>
                          <table className="table small" style={{ tableLayout: "fixed", width: "auto" }}>
                            <thead>
                              <tr>
                                <th style={{ width: 60 }}>Topic</th>
                                {result.graph_insights.author_topic_network.top_communities.map((id) => (
                                  <th key={id} style={{ textAlign: "center", width: 40 }}>
                                    C{id + 1}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {result.graph_insights.author_topic_network.topic_projection.map((row, i) => (
                                <tr key={i}>
                                  <td style={{ textAlign: "right", paddingRight: 8 }}>
                                    C{result.graph_insights.author_topic_network!.top_communities[i] + 1}
                                  </td>
                                  {row.map((val, j) => {
                                    const maxVal = Math.max(...result.graph_insights.author_topic_network!.topic_projection!.flat());
                                    const intensity = maxVal > 0 ? val / maxVal : 0;
                                    const bg = `rgba(255, 165, 0, ${0.1 + 0.9 * intensity})`; // Orange scale
                                    const fg = intensity > 0.5 ? "#fff" : "#000";
                                    return (
                                      <td key={j} style={{ backgroundColor: val > 0 ? bg : "transparent", color: val > 0 ? fg : "#ccc", textAlign: "center", fontSize: "0.7rem" }} title={`Similarity: ${val}`}>
                                        {val > 0 ? Math.round(val) : ""}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}


                {result.graph_insights.country_topic_network && (
                  <div style={{ marginTop: "1rem" }}>
                    <h4>8. Country-Topic Bipartite Graph</h4>
                    <div style={{ marginBottom: "1rem" }}>
                      <h5>Country-Topic Matrix (Top Countries x Top Communities)</h5>
                      <div style={{ overflowX: "auto" }}>
                        <table className="table small" style={{ tableLayout: "fixed", width: "auto" }}>
                          <thead>
                            <tr>
                              <th style={{ width: 150 }}>Country</th>
                              {result.graph_insights.country_topic_network.top_communities.map((id) => (
                                <th key={id} style={{ textAlign: "center", width: 40 }}>
                                  C{id + 1}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.graph_insights.country_topic_network.matrix.map((row, i) => (
                              <tr key={i}>
                                <td style={{ textAlign: "right", paddingRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={result.graph_insights.country_topic_network!.top_countries[i]}>
                                  {result.graph_insights.country_topic_network!.top_countries[i]}
                                </td>
                                {row.map((val, j) => {
                                  // Heatmap coloring
                                  const maxVal = Math.max(...result.graph_insights.country_topic_network!.matrix.flat());
                                  const intensity = maxVal > 0 ? val / maxVal : 0;
                                  const bg = `rgba(0, 128, 128, ${0.1 + 0.9 * intensity})`; // Teal scale
                                  const fg = intensity > 0.5 ? "#fff" : "#000";

                                  return (
                                    <td
                                      key={j}
                                      style={{
                                        backgroundColor: val > 0 ? bg : "transparent",
                                        color: val > 0 ? fg : "#ccc",
                                        textAlign: "center",
                                        border: "1px solid #eee",
                                        fontSize: "0.8rem"
                                      }}
                                      title={`${result.graph_insights.country_topic_network!.top_countries[i]} has ${val} citations in Community ${result.graph_insights.country_topic_network!.top_communities[j] + 1}`}
                                    >
                                      {val > 0 ? Math.round(val) : ""}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="table-note">
                          Total citations received by each country in the top communities.
                        </div>
                      </div>
                    </div>

                    {/* Projections */}
                    {result.graph_insights.country_topic_network.country_projection && (
                      <div style={{ marginBottom: "1rem" }}>
                        <h5>Country-Country Projection (Shared Topic Impact)</h5>
                        <div style={{ overflowX: "auto" }}>
                          <table className="table small" style={{ tableLayout: "fixed", width: "auto" }}>
                            <thead>
                              <tr>
                                <th style={{ width: 150 }}>Country</th>
                                {result.graph_insights.country_topic_network.top_countries.map((c, idx) => (
                                  <th key={idx} style={{ textAlign: "center", width: 40, fontSize: "0.7rem", overflow: "hidden", textOverflow: "ellipsis" }} title={c}>
                                    {idx + 1}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {result.graph_insights.country_topic_network.country_projection.map((row, i) => (
                                <tr key={i}>
                                  <td style={{ textAlign: "right", paddingRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={result.graph_insights.country_topic_network!.top_countries[i]}>
                                    {result.graph_insights.country_topic_network!.top_countries[i]}
                                  </td>
                                  {row.map((val, j) => {
                                    const maxVal = Math.max(...result.graph_insights.country_topic_network!.country_projection!.flat());
                                    const intensity = maxVal > 0 ? val / maxVal : 0;
                                    const bg = `rgba(128, 0, 128, ${0.1 + 0.9 * intensity})`; // Purple scale
                                    const fg = intensity > 0.5 ? "#fff" : "#000";
                                    return (
                                      <td key={j} style={{ backgroundColor: val > 0 ? bg : "transparent", color: val > 0 ? fg : "#ccc", textAlign: "center", fontSize: "0.7rem" }} title={`Similarity: ${val}`}>
                                        {val > 0 ? Math.round(val * 100) / 100 : ""}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="message info">Graph metrics not available. Please re-run the analysis.</div>
            )}
          </div>
        </details>

        {/* Knowledge Graph Insights (RQ1-RQ9) */}
        {result.graph_insights && (
          <details className="info-details" style={{ marginTop: "1rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
              ℹ️ Knowledge Graph Insights (RQ1-RQ9)
            </summary>

            {!result.graph_insights.kg_questions ? (
              <div className="message warning" style={{ marginTop: "1rem" }}>
                <strong>Analysis Not Available:</strong> {result.graph_insights.kg_status?.message || "Unknown reason."}
                <br />
                <small>
                  Ensure your CSV contains an <code>EID</code>, <code>DOI</code>, or <code>Scopus ID</code> column
                  and a <code>References</code> column to build the citation graph.
                </small>
              </div>
            ) : (
              <div className="info-content" style={{ marginTop: "0.5rem", fontSize: "0.9rem", lineHeight: "1.5", color: "var(--text-soft)" }}>
                <p className="small text-muted">
                  Analysis based on heterogeneous graph (Papers, Authors, Communities, Concepts).
                </p>

                {/* RQ1: Community Size */}
                <details className="info-details" style={{ marginBottom: "1rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                    ℹ️ RQ1: Main Conceptual Communities
                  </summary>
                  <div className="info-content" style={{ marginTop: "0.5rem" }}>
                    <div style={{ marginBottom: "1rem" }}>
                      {/* Button moved to top control panel */}
                    </div>
                    <table className="table small">
                      <thead>
                        <tr>
                          <th>Community ID (1-based)</th>
                          <th>Topic Label (LLM)</th>
                          <th>Number of Papers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(result.graph_insights.kg_questions?.rq1 || []).map((c) => (
                          <tr key={c.community}>
                            <td>
                              Community {c.community + 1}
                              {llmLabels[c.community] ? <div style={{ fontSize: '0.8rem', color: '#666' }}>{llmLabels[c.community]}</div> : null}
                            </td>
                            <td><strong>{llmLabels[c.community] || "-"}</strong></td>
                            <td>{c.n_papers}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                {/* RQ2: Foundational Papers */}
                <details className="info-details" style={{ marginBottom: "1rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                    ℹ️ RQ2: Foundational Papers (Internal Citations) - Top 5 Communities
                  </summary>
                  <div className="info-content" style={{ marginTop: "0.5rem" }}>
                    {(result.graph_insights.kg_questions?.rq2 || []).slice(0, 5).map((c) => (
                      <div key={c.community} style={{ marginBottom: "1rem" }}>
                        <strong>
                          Community {c.community + 1}
                          {llmLabels[c.community] ? `: ${llmLabels[c.community]}` : ""}
                        </strong>
                        <ul style={{ fontSize: "0.85rem", paddingLeft: "1.2rem", marginTop: "0.5rem" }}>
                          {c.papers.map((p, idx) => (
                            <li key={idx} style={{ marginBottom: "0.25rem" }}>
                              <span style={{ fontWeight: 600 }}>{p.citations} citations:</span> {p.title} ({p.year})
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>

                {/* RQ3: Broker Authors */}
                <details className="info-details" style={{ marginBottom: "1rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                    ℹ️ RQ3: Broker Authors (Cross-Community)
                  </summary>
                  <div className="info-content" style={{ marginTop: "0.5rem" }}>
                    <table className="table small">
                      <thead>
                        <tr>
                          <th>Author</th>
                          <th># Communities</th>
                          <th>Communities</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(result.graph_insights.kg_questions?.rq3 || []).map((a, idx) => (
                          <tr key={idx}>
                            <td>{a.author}</td>
                            <td>{a.n_communities}</td>
                            <td>{a.communities.join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                {/* RQ4: Semantic vs Citation */}
                <details className="info-details" style={{ marginBottom: "1rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                    ℹ️ RQ4: Semantic vs Citation Connections
                  </summary>
                  <div className="info-content" style={{ marginTop: "0.5rem" }}>
                    <table className="table small">
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Target</th>
                          <th>Citation Count</th>
                          <th>Semantic Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(result.graph_insights.kg_questions?.rq4 || []).map((r, idx) => (
                          <tr key={idx}>
                            <td>C{r.source + 1}</td>
                            <td>C{r.target + 1}</td>
                            <td>{r.citation_count}</td>
                            <td>{r.semantic_weight.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                {/* RQ5: Concept Diffusion */}
                <details className="info-details" style={{ marginBottom: "1rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                    ℹ️ RQ5: Concept Diffusion (Top Keywords)
                  </summary>
                  <div className="info-content" style={{ marginTop: "0.5rem" }}>
                    {(result.graph_insights.kg_questions?.rq5 || []).map((k, idx) => (
                      <div key={idx} style={{ marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                        <strong>{k.concept}</strong>:
                        Found in {Object.keys(k.comm_dist).length} communities.
                        Top years: {Object.entries(k.year_dist).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([y, c]) => `${y} (${c})`).join(", ")}
                      </div>
                    ))}
                  </div>
                </details>

                {/* RQ6: Collaboration Gaps */}
                <details className="info-details" style={{ marginBottom: "1rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                    ℹ️ RQ6: Collaboration Gaps (Shared Authors)
                  </summary>
                  <div className="info-content" style={{ marginTop: "0.5rem" }}>
                    <table className="table small">
                      <thead>
                        <tr>
                          <th>Comm A</th>
                          <th>Comm B</th>
                          <th>Shared Authors</th>
                          <th>Semantic Sim</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(result.graph_insights.kg_questions?.rq6 || []).map((r, idx) => (
                          <tr key={idx}>
                            <td>C{r.source + 1}</td>
                            <td>C{r.target + 1}</td>
                            <td>{r.shared_authors}</td>
                            <td>{r.semantic_weight.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                {/* RQ7: Top Institutions */}
                <details className="info-details" style={{ marginBottom: "1rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                    ℹ️ RQ7: Top Institutions per Community
                  </summary>
                  <div className="info-content" style={{ marginTop: "0.5rem" }}>
                    <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                      Analysis based on heterogeneous graph (Papers, Authors, Communities, Concepts, Affiliations).
                    </p>
                    {result.graph_insights.kg_questions?.rq7 && (result.graph_insights.kg_questions.rq7 || []).length > 0 ? (
                      (result.graph_insights.kg_questions?.rq7 || []).slice(0, 5).map((c) => (
                        <div key={c.community} style={{ marginBottom: "1rem" }}>
                          <strong>
                            Community {c.community + 1}
                            {llmLabels[c.community] ? `: ${llmLabels[c.community]}` : ""}
                          </strong>
                          <ul style={{ fontSize: "0.85rem", paddingLeft: "1.2rem", marginTop: "0.5rem" }}>
                            {c.institutions.map((inst, idx) => (
                              <li key={idx}>
                                {inst.institution} {inst.country && inst.country !== "Unknown" ? `(${inst.country})` : ""} ({inst.count})
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: "0.85rem", color: "#666" }}>
                        No affiliation data available.
                      </p>
                    )}
                  </div>
                </details>

                {/* RQ8: Top Countries per Topic */}
                <details className="info-details" style={{ marginBottom: "1rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                    ℹ️ RQ8: Top Countries per Topic
                  </summary>
                  <div className="info-content" style={{ marginTop: "0.5rem" }}>
                    {!result.graph_insights.kg_questions?.rq8 || (result.graph_insights.kg_questions.rq8 || []).length === 0 ? (
                      <div className="message info">
                        No country data available. Ensure "Affiliations" column exists.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                        {(result.graph_insights.kg_questions?.rq8 || []).map((item) => (
                          <div key={item.community} style={{ flex: "1 1 45%", border: "1px solid #eee", padding: "1rem", borderRadius: "8px" }}>
                            <h5 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Community {item.community + 1}</h5>
                            <table className="table small">
                              <thead>
                                <tr>
                                  <th>Country</th>
                                  <th>Count</th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.countries.map((c, idx) => (
                                  <tr key={idx}>
                                    <td>{c.country}</td>
                                    <td>{c.count}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>

                {/* RQ9: Country Frequency Over Time */}
                <details className="info-details" style={{ marginBottom: "1rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                    ℹ️ RQ9: Country Frequency Over Time
                  </summary>
                  <div className="info-content" style={{ marginTop: "0.5rem" }}>
                    {!result.graph_insights.kg_questions?.rq9 ? (
                      <div className="message info">
                        No trend data available. Ensure "Affiliations" column exists.
                      </div>
                    ) : (
                      <div>
                        <h4 style={{ textAlign: "center", marginBottom: "1rem" }}>Global Top Countries Over Time</h4>
                        <div style={{ height: 400 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={result.graph_insights.kg_questions?.rq9?.global || []}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="year" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              {(() => {
                                const allKeys = new Set<string>();
                                result.graph_insights.kg_questions?.rq9?.global.forEach(d => {
                                  Object.keys(d).forEach(k => {
                                    if (k !== "year") allKeys.add(k);
                                  });
                                });
                                return Array.from(allKeys).map((key, i) => (
                                  <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                                ));
                              })()}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}
          </details>
        )}
      </div>
    </div>
  );
};

const TagCloud: React.FC<{ terms: { term: string; weight: number }[] }> = ({
  terms,
}) => {
  if (!terms || terms.length === 0) return null;
  const maxWeight = Math.max(...terms.map((t) => t.weight));
  const minWeight = Math.min(...terms.map((t) => t.weight));
  const range = maxWeight - minWeight || 1;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        justifyContent: "center",
        alignItems: "center",
        padding: "10px",
        backgroundColor: "#f9f9f9",
        borderRadius: "8px",
      }}
    >
      {terms.map((t, i) => {
        const fontSize = 12 + ((t.weight - minWeight) / range) * 18; // 12px to 30px
        const color = COLORS[i % COLORS.length];
        return (
          <span
            key={t.term}
            style={{
              fontSize: `${fontSize}px`,
              color,
              fontWeight: 500,
              cursor: "default",
            }}
            title={`Weight: ${t.weight.toFixed(3)}`}
          >
            {t.term}
          </span>
        );
      })}
    </div>
  );
};


interface AuthScreenProps {
  googleAuthEnabled: boolean;
  onLogin: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ googleAuthEnabled, onLogin }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'resend'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const extractUser = (data: unknown): User => {
    const candidate = (data as { user?: User })?.user ?? data;
    const user = candidate as Partial<User>;

    if (!user || typeof user.email !== 'string') {
      throw new Error('The authentication server returned an invalid user response.');
    }

    return {
      id: typeof user.id === 'number' ? user.id : 0,
      email: user.email,
      name: typeof user.name === 'string' && user.name ? user.name : user.email,
      picture: typeof user.picture === 'string' ? user.picture : '',
      role: typeof user.role === 'string' && user.role ? user.role : 'user',
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const response = await axios.post(`${API_BASE}/auth/login`, { email, password });
        onLogin(extractUser(response.data));
      } else if (mode === 'signup') {
        await axios.post(`${API_BASE}/auth/signup`, { email, password, name });
        alert('Registration successful! Please check your email for the verification link to activate your account.');
        setMode('login');
      } else if (mode === 'resend') {
        await axios.post(`${API_BASE}/auth/resend-activation`, { email });
        alert('If the account exists and is inactive, a new activation link has been sent.');
        setMode('login');
      } else {
        await axios.post(`${API_BASE}/auth/forgot-password`, { email });
        alert('If an account exists, a reset link has been sent.');
        setMode('login');
      }
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.detail ||
          err.response?.data?.message ||
          'Authentication failed. Please try again.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    const credential = credentialResponse.credential;
    if (!credential) {
      setError('Google did not return a valid sign-in credential.');
      return;
    }

    setError(null);
    setIsGoogleSubmitting(true);

    try {
      const response = await axios.post(`${API_BASE}/auth/google`, { credential });
      onLogin(extractUser(response.data));
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const serverMessage = err.response?.data?.detail || err.response?.data?.message;
        setError(
          serverMessage ||
          (status === 404
            ? 'Google sign-in is not enabled on the backend yet. Add POST /auth/google to the backend.'
            : 'Google sign-in failed. Please try again.')
        );
      } else {
        setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const heading =
    mode === 'login'
      ? 'Welcome Back'
      : mode === 'signup'
        ? 'Create Account'
        : mode === 'resend'
          ? 'Resend Activation'
          : 'Reset Password';

  return (
    <div className="app" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '1rem' }}>
      <div className="card" style={{ textAlign: 'center', padding: '3rem', maxWidth: '420px', width: '100%' }}>
        <div style={{ marginBottom: '1rem', fontWeight: 'bold', color: '#555' }}>
          {heading}
        </div>
        <h1 style={{ marginBottom: '2rem' }}>S3 Bibliometric</h1>

        {error && (
          <div className="message error" role="alert" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {mode === 'login' && googleAuthEnabled && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', minHeight: '44px' }}>
              {isGoogleSubmitting ? (
                <button className="secondary-button" type="button" disabled style={{ width: '100%' }}>
                  Signing in with Google…
                </button>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-in was cancelled or could not be completed.')}
                  text="continue_with"
                  shape="rectangular"
                  size="large"
                  width="356"
                  useOneTap={false}
                />
              )}
            </div>

            <div
              aria-hidden="true"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                margin: '1.5rem 0',
                color: '#777',
                fontSize: '0.85rem',
              }}
            >
              <span style={{ height: 1, background: '#ddd', flex: 1 }} />
              <span>or use email</span>
              <span style={{ height: 1, background: '#ddd', flex: 1 }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="field-input"
              style={{ width: '100%' }}
            />
          )}

          <input
            type={mode === 'login' ? 'text' : 'email'}
            placeholder={mode === 'login' ? 'Email or Username' : 'Email'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete={mode === 'login' ? 'username' : 'email'}
            className="field-input"
            style={{ width: '100%' }}
          />

          {mode !== 'forgot' && mode !== 'resend' && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="field-input"
              style={{ width: '100%' }}
            />
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={isSubmitting || isGoogleSubmitting}
            style={{ width: '100%' }}
          >
            {isSubmitting
              ? 'Please wait…'
              : mode === 'login'
                ? 'Login'
                : mode === 'signup'
                  ? 'Sign Up'
                  : mode === 'resend'
                    ? 'Resend Link'
                    : 'Send Reset Link'}
          </button>
        </form>

        {mode === 'login' && !googleAuthEnabled && (
          <div style={{ marginTop: '1rem', color: '#777', fontSize: '0.8rem' }}>
            Google sign-in will appear after VITE_GOOGLE_CLIENT_ID is configured in Render.
          </div>
        )}

        <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {mode === 'login' && (
            <>
              <a href="#" className="link" onClick={(e) => { e.preventDefault(); setError(null); setMode('signup'); }}>Create an account</a>
              <a href="#" className="link" onClick={(e) => { e.preventDefault(); setError(null); setMode('forgot'); }}>Forgot password?</a>
              <a href="#" className="link" onClick={(e) => { e.preventDefault(); setError(null); setMode('resend'); }}>Resend Activation Email</a>
            </>
          )}
          {mode !== 'login' && (
            <a href="#" className="link" onClick={(e) => { e.preventDefault(); setError(null); setMode('login'); }}>
              Back to Login
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const MainContent: React.FC<{ googleAuthEnabled: boolean }> = ({ googleAuthEnabled }) => {
  const { user, setUser, logout } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showScopusPage, setShowScopusPage] = useState(false);


  // CSV upload + S3 pipeline
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<CsvAnalysisResult | null>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvProgress, setCsvProgress] = useState<{
    percent: number;
    label: string;
  } | null>(null);
  const [isCleaningData, setIsCleaningData] = useState(false);
  const [modalMode, setModalMode] = useState<'labeling' | 'cleaning'>('labeling');

  // Time frame settings
  const [startYear, setStartYear] = useState<number | "">("");
  const [endYear, setEndYear] = useState<number | "">("");
  const [windowSize] = useState<number>(2);
  const [showFilters, setShowFilters] = useState(false);

  // LLM Labeling
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showScopusKeyModal, setShowScopusKeyModal] = useState(false); // NEW
  const [modelType, setModelType] = useState<"gemini" | "local">("gemini");
  const [apiKey, setApiKey] = useState("");
  const [scopusKey, setScopusKey] = useState(""); // NEW
  const [instToken, setInstToken] = useState(""); // NEW
  const [localModelName, setLocalModelName] = useState("Qwen/QwQ-32B-Preview");
  const [use8bit, setUse8bit] = useState(true);
  const [llmLabels, setLlmLabels] = useState<Record<number, string>>({});
  const [isLabeling, setIsLabeling] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false); // NEW
  const [isPdfManagerOpen, setIsPdfManagerOpen] = useState(false);
  const [pdfManagerFilterIds, setPdfManagerFilterIds] = useState<number[] | null>(null); // NEW

  // Topic modeling parameters
  const [topPapersPerWindow, setTopPapersPerWindow] = useState(2);
  const [topicWindowSize, setTopicWindowSize] = useState(2); // Display Configuration State
  const [numTopicChar, setNumTopicChar] = useState(5);
  const [numCitationAnalysis] = useState(10);

  // Chord Diagram State
  const [currentUsecase, setCurrentUsecase] = useState<string>("");
  const [chordThreshold, setChordThreshold] = useState<number>(5);
  const [chordTopN, setChordTopN] = useState<number>(10);
  const [chordUrls, setChordUrls] = useState<{ numeric: string; topic: string } | null>(null);
  const [chordTs, setChordTs] = useState<number>(Date.now());
  const [isUpdatingChord, setIsUpdatingChord] = useState(false);
  const [numIntellectualStructure, setNumIntellectualStructure] = useState(10);
  const [numInterdisciplinary, setNumInterdisciplinary] = useState(10);
  const [periodStart, setPeriodStart] = useState<number | "">("");
  const [periodEnd, setPeriodEnd] = useState<number | "">("");
  const [maxPapersForLlm, setMaxPapersForLlm] = useState(10);
  const [showInterdisciplinary, setShowInterdisciplinary] = useState(false);
  const [topNCommunities, setTopNCommunities] = useState(50); // Default to 50 per user request

  // Community Details Modal
  const [selectedCommunityForDetails, setSelectedCommunityForDetails] = useState<number | null>(null);

  // Deep S3 Analysis State
  const [isDeepS3Open, setIsDeepS3Open] = useState(false);
  const [deepS3Params, setDeepS3Params] = useState<{
    jobId: string;
    communityId: number;
    communityName: string;
    selectedPaperIds: number[];
    preSelectedPapersCount: number;
  } | null>(null);

  const handleOpenDeepS3 = (params: {
    jobId: string;
    communityId: number;
    communityName: string;
    selectedPaperIds: number[];
    preSelectedPapersCount: number;
  }) => {
    setDeepS3Params(params);
    setIsDeepS3Open(true);
  };


  const handleCommunityClick = (communityId: number) => {
    setSelectedCommunityForDetails(communityId);
  };

  React.useEffect(() => {
    try {
      const savedResult = localStorage.getItem("s3_csvResult_v2");
      if (savedResult) {
        let parsed = JSON.parse(savedResult);
        // Basic validation: must have communities array
        if (parsed && Array.isArray(parsed.communities)) {
          // Sanitize: Restore nulls to safe defaults
          const sanitize = (key: string | null, obj: any): any => {
            if (obj === null || obj === undefined) {
              // String heuristic
              const strKeys = ['title', 'abstract', 'author', 'name', 'label', 'term', 'journal', 'country', 'agency', 'institution', 'description'];
              if (key && strKeys.some(k => key.toLowerCase().includes(k))) return "";
              return 0;
            }

            if (Array.isArray(obj)) {
              return obj.map(item => sanitize(null, item));
            }

            if (typeof obj === 'object') {
              const newObj: any = {};
              for (const k in obj) {
                newObj[k] = sanitize(k, obj[k]);
              }
              return newObj;
            }
            return obj;
          };

          parsed = sanitize(null, parsed);
          setCsvResult(parsed);

          // Restore currentUsecase from job_id
          if (parsed.job_id) {
            const jid = parsed.job_id.toLowerCase();
            if (jid.includes("innovation")) setCurrentUsecase("innovation");
            else if (jid.includes("ecosystem")) setCurrentUsecase("ecosystem");
            else if (jid.includes("merger") || jid.includes("ma")) setCurrentUsecase("ma");
            else if (jid.includes("coo")) setCurrentUsecase("coo");
          }
        } else {
          console.warn("Invalid saved result found in localStorage, ignoring.");
        }
      }
      const savedLabels = localStorage.getItem("s3_llmLabels");
      if (savedLabels) {
        setLlmLabels(JSON.parse(savedLabels));
      }
    } catch (e) {
      console.error("Failed to load from local storage", e);
      // If critical failure, maybe clear it?
      // localStorage.removeItem("s3_csvResult");
    }
  }, []);

  // Fetch interdisciplinary analysis if missing (e.g. from stale local storage)
  React.useEffect(() => {
    if (csvResult && !csvResult.interdisciplinary_analysis && csvResult.job_id) {
      getInterdisciplinaryAnalysis(csvResult.job_id).then(analysis => {
        setCsvResult(prev => prev ? { ...prev, interdisciplinary_analysis: analysis } : prev);
      }).catch(err => console.error("Failed to fetch missing interdisciplinary data", err));
    }
  }, [csvResult]);

  // Sync chord diagrams from result
  // Sync chord diagrams from result
  React.useEffect(() => {
    if (csvResult?.chord_diagrams) {
      setChordUrls(csvResult.chord_diagrams);
      setChordTs(Date.now());
    } else {
      setChordUrls(null);
    }
  }, [csvResult]);

  const handleUpdateChord = async () => {
    if (!currentUsecase) {
      alert("No active usecase found. Please reload the usecase.");
      return;
    }
    setIsUpdatingChord(true);
    try {
      const res = await axios.post(`${API_BASE}/chord/regenerate`, {
        usecase: currentUsecase,
        threshold: chordThreshold,
        top_n: chordTopN
      });
      if (res.data) {
        setChordUrls(res.data);
        setChordTs(Date.now());
      }
    } catch (e) {
      console.error("Failed to regenerate chord diagrams", e);
      alert("Failed to update chord diagrams. Check console.");
    } finally {
      setIsUpdatingChord(false);
    }
  };

  const handleLoadInnovation = async () => {
    try {
      setIsUploadingCsv(true);
      setCsvError(null);
      setCurrentUsecase("innovation");
      setChordThreshold(5);
      const res = await loadInnovationUsecase();
      setCsvResult(res);
    } catch (err: any) {
      setCsvError(err.message || "Failed to load innovation usecase");
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleLoadEcosystem = async () => {
    try {
      setIsUploadingCsv(true);
      setCsvError(null);
      setCurrentUsecase("ecosystem");
      setChordThreshold(5);
      const res = await loadEcosystemUsecase();
      setCsvResult(res);
    } catch (err: any) {
      setCsvError(err.message || "Failed to load ecosystem usecase");
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleLoadMergersAcquisition = async () => {
    try {
      setIsUploadingCsv(true);
      setCsvError(null);
      setCurrentUsecase("ma");
      setChordThreshold(5);
      const res = await loadMergersAcquisitionUsecase();
      setCsvResult(res);
    } catch (err: any) {
      setCsvError(err.message || "Failed to load Mergers & Acquisition usecase");
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleLoadCOO = async () => {
    try {
      setIsUploadingCsv(true);
      setCsvError(null);
      setCurrentUsecase("coo");
      setChordThreshold(5);
      const res = await loadCOOUsecase();
      setCsvResult(res);
    } catch (err: any) {
      setCsvError(err.message || "Failed to load COO usecase");
    } finally {
      setIsUploadingCsv(false);
    }
  };

  React.useEffect(() => {
    try {
      if (csvResult) {
        // Create a lightweight copy to avoid QuotaExceededError
        const lightResult = { ...csvResult };
        // Remove potentially large network/graph data
        if ('paper_network' in lightResult) delete (lightResult as any).paper_network;
        if ('bc_network' in lightResult) delete (lightResult as any).bc_network;
        if ('cc_network' in lightResult) delete (lightResult as any).cc_network;

        localStorage.setItem("s3_csvResult_v2", JSON.stringify(lightResult));
      }
    } catch (e) {
      console.error("Failed to save result to local storage (likely too big)", e);
    }
  }, [csvResult]);

  React.useEffect(() => {
    localStorage.setItem("s3_llmLabels", JSON.stringify(llmLabels));
  }, [llmLabels]);





  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setCsvFile(file);
    setCsvError(null);
    setCsvResult(null);
    setCsvProgress(null);
    // Reset labeling state on new file
    setLlmLabels({});
  };

  const handleGenerateLabels = async () => {
    // Validate inputs based on model type
    if (modelType === "gemini" && !apiKey) {
      alert("Please enter your Gemini API key.");
      return;
    }

    if (!csvResult || !('job_id' in csvResult)) {
      alert("No active job found. Please run the analysis first.");
      return;
    }

    setIsLabeling(true);
    setShowApiKeyModal(false);

    try {
      const jobId = (csvResult as any).job_id;
      // Pass the job directory if available (returned by backend)
      const jobDirectory = csvResult.job_directory || undefined;

      const res = await generateTopicLabels(
        jobId,
        modelType,
        apiKey || undefined,
        localModelName,
        use8bit,
        jobDirectory,
        topPapersPerWindow,
        topicWindowSize,
        periodStart === "" ? undefined : periodStart,
        periodEnd === "" ? undefined : periodEnd,
        maxPapersForLlm,
        topNCommunities
      );

      // Convert array to map for easy lookup
      const labelMap: Record<number, string> = {};
      res.community_labels.forEach(item => {
        labelMap[item.id] = item.label;
      });
      console.log("DEBUG: Received labels map:", labelMap);
      setLlmLabels(labelMap);

      if (Object.keys(labelMap).length === 0) {
        alert("Warning: No topic labels were generated. Check your API Key or quotas, or check the server logs.");
      } else {
        alert("Topic labels generated successfully!");
      }
    } catch (err: any) {
      alert("Failed to generate labels: " + err.message);
    } finally {
      setIsLabeling(false);
    }
  };

  const handleRunCsvAnalysis = async () => {
    if (!csvFile) return;
    setIsUploadingCsv(true);
    setCsvError(null);
    setCsvResult(null);
    setCsvProgress({ percent: 0, label: "Starting…" });
    try {
      const result = await uploadAndAnalyzeCsv(
        csvFile,
        (stage, progress) => {
          setCsvProgress({
            percent: progress * 100,
            label: stage || "Processing…",
          });
        },
        startYear === "" ? undefined : startYear,
        endYear === "" ? undefined : endYear,
        windowSize
      );
      setCsvResult(result);
      setCsvProgress((prev) =>
        prev
          ? { ...prev, percent: 100, label: "Done." }
          : { percent: 100, label: "Done." }
      );
    } catch (err: any) {
      setCsvError(err?.message ?? "Failed to analyze CSV.");
      setCsvProgress((prev) =>
        prev
          ? { ...prev, percent: 100, label: "Failed (see error above)." }
          : { percent: 100, label: "Failed (see error above)." }
      );
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleCleanInterdisciplinary = async () => {
    if (!csvResult || !('job_id' in csvResult)) return;

    // Validate inputs based on model type (same as label gen)
    if (modelType === "gemini" && !apiKey) {
      alert("Please enter your Gemini API key.");
      return;
    }

    setIsCleaningData(true);
    setShowApiKeyModal(false); // Close modal

    try {
      const jobId = (csvResult as any).job_id;
      const res = await cleanInterdisciplinaryData(
        jobId,
        modelType,
        apiKey || undefined,
        localModelName,
        use8bit,
        csvResult.job_directory || undefined
      );
      setCsvResult(prev => prev ? ({
        ...prev,
        interdisciplinary_analysis: res.interdisciplinary_analysis
      }) : null);
      alert("Data scrubbed successfully! The charts have been updated.");
    } catch (e: any) {
      alert("Error cleaning data: " + e.message);
    } finally {
      setIsCleaningData(false);
    }
  };

  const handleEnhanceCitations = async () => {
    if (!csvResult || !('job_id' in csvResult)) return;

    if (!scopusKey) {
      alert("Please enter a Scopus API Key.");
      return;
    }

    setIsEnhancing(true);
    setShowScopusKeyModal(false);

    try {
      const jobId = (csvResult as any).job_id;
      await enhanceCitations(jobId, scopusKey, instToken);
      alert("Scopus enrichment started! This runs in the background. Check back later via the 'Check Status' button.");
    } catch (e: any) {
      alert("Error starting enrichment: " + e.message);
    } finally {
      setIsEnhancing(false);
    }
  };

  if (!user) {
    return <AuthScreen googleAuthEnabled={googleAuthEnabled} onLogin={setUser} />;
  }

  if (showScopusPage) {
    return <ScopusInstructions onBack={() => setShowScopusPage(false)} />;
  }

  if (showAdmin) {
    return (
      <div className="app">
        <div className="app-shell">
          <header className="app-header">
            <div>
              <h1 className="app-title">Admin Dashboard</h1>
            </div>
            <button className="secondary-button" onClick={() => setShowAdmin(false)}>
              Back to App
            </button>
          </header>
          <AdminDashboard user={user} />
        </div>
      </div>
    );
  }






  return (
    <div className="app">
      <div className="app-shell">
        <header className="app-header">
          <div>
            <h1 className="app-title">S3 Application</h1>
            <p className="app-subtitle">
              Semantic Similarity Score: A New Bibliometric Method for Mapping Intellectual Structures in Business Research
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {user.picture && <img src={user.picture} alt={user.name} style={{ width: 32, height: 32, borderRadius: '50%' }} />}
              <span style={{ fontSize: '0.9rem' }}>
                {user.name}
                {user.role === 'admin' && <span style={{ color: 'red', fontWeight: 'bold', marginLeft: '4px' }}>(Admin)</span>}
              </span>
            </div>
            {user.role === 'admin' && (
              <button className="secondary-button" onClick={() => setShowAdmin(true)} style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}>
                Admin
              </button>
            )}
            <button className="secondary-button" onClick={logout} style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}>
              Logout
            </button>
          </div>
        </header>



        <main className="app-main">
          {/* CSV pipeline */}
          <section className="card">
            <div className="card-header">
              <h2>0. Upload Scopus CSV (S3 pipeline)</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <span className="card-subtitle">
                  Upload a CSV exported from Scopus and run the S3 analysis. The stages below show progress.
                </span>
                <button
                  onClick={() => setShowScopusPage(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '0.85rem',
                    padding: 0
                  }}
                >
                  How to export?
                </button>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                <button
                  className="secondary-button"
                  onClick={handleLoadInnovation}
                  disabled={isUploadingCsv}
                >
                  ✨ Load "Innovation & Diversity" Usecase
                </button>
                <button
                  className="secondary-button"
                  onClick={handleLoadEcosystem}
                  disabled={isUploadingCsv}
                >
                  🌿 Load "Ecosystem" Usecase
                </button>
                <button
                  className="secondary-button"
                  onClick={handleLoadMergersAcquisition}
                  disabled={isUploadingCsv}
                >
                  🤝 Load "Mergers & Acquisition" Usecase
                </button>
              </div>
            </div>
            <div className="card-body">
              <label className="field">
                <span className="field-label">Scopus CSV file</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvChange}
                />
              </label>

              <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showFilters ? "0.5rem" : "0" }}>
                  <div
                    onClick={() => setShowFilters(!showFilters)}
                    style={{
                      cursor: "pointer",
                      color: "var(--accent)",
                      fontWeight: 500,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      userSelect: "none"
                    }}
                  >
                    <span>{showFilters ? "▼" : "▶"}</span> Filter
                  </div>
                  {csvResult?.excel_url && (
                    <button
                      onClick={() => {
                        window.open(`${API_BASE}/download/${csvResult.excel_url}`, "_blank");
                      }}
                      style={{
                        padding: "0.3rem 0.6rem",
                        background: "#217346",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.80rem",
                        fontWeight: 500
                      }}
                      title="Download full analysis results as Excel"
                    >
                      📥 Download Excel
                    </button>
                  )}
                </div>

                {showFilters && (
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                    <label className="field" style={{ flex: 1 }}>
                      <span className="field-label">Start Year (Optional)</span>
                      <input
                        type="number"
                        placeholder="e.g. 2015"
                        value={startYear}
                        onChange={(e) => setStartYear(e.target.value ? parseInt(e.target.value) : "")}
                      />
                    </label>
                    <label className="field" style={{ flex: 1 }}>
                      <span className="field-label">End Year (Optional)</span>
                      <input
                        type="number"
                        placeholder="e.g. 2020"
                        value={endYear}
                        onChange={(e) => setEndYear(e.target.value ? parseInt(e.target.value) : "")}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <button
                  className="primary-button"
                  onClick={handleRunCsvAnalysis}
                  disabled={!csvFile || isUploadingCsv}
                >
                  {isUploadingCsv ? "Processing…" : "Run S3 pipeline"}
                </button>



                <button
                  className="secondary-button"
                  onClick={() => { setModalMode('labeling'); setShowApiKeyModal(true); }}
                  disabled={!csvResult || isUploadingCsv || isLabeling}
                >
                  {isLabeling ? "Generating Labels..." : "✨ Generate Topic Labels"}
                </button>
              </div>

              {csvProgress && (
                <div className="progress-container">
                  <div className="progress-label">{csvProgress.label}</div>
                  <div className="progress-bar-outer">
                    <div
                      className="progress-bar-inner"
                      style={{ width: `${csvProgress.percent}%` }}
                    />
                  </div>
                  <div className="progress-percent">
                    {Math.round(csvProgress.percent)}%
                  </div>

                  <ul className="csv-stepper">
                    {CSV_STEPS.map((step, index) => {
                      const currentIndex = stepIndexFromStage(
                        csvProgress.label
                      );
                      const state =
                        index < currentIndex
                          ? "done"
                          : index === currentIndex
                            ? "active"
                            : "todo";
                      return (
                        <li
                          key={step}
                          className={`csv-step csv-step--${state}`}
                        >
                          <span className="csv-step-dot" />
                          <span className="csv-step-label">{step}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {csvError && (
                <div className="message error">
                  <strong>Error:</strong> {csvError}
                </div>
              )}

              {csvResult && (
                <div className="csv-output">
                  <CsvResultSummary
                    result={csvResult}
                    llmLabels={llmLabels}
                    onCommunityClick={handleCommunityClick}
                  />
                </div>
              )}
            </div>
          </section>

          {selectedCommunityForDetails !== null && csvResult && csvResult.paper_network && (
            <CommunityPapersModal
              jobId={(csvResult as any).job_id || ""}
              communityId={selectedCommunityForDetails}
              communityName={llmLabels[selectedCommunityForDetails] || `Community ${selectedCommunityForDetails + 1}`}
              papers={csvResult.paper_network.nodes
                .filter(n => n.community === selectedCommunityForDetails)
                .map(n => ({
                  id: Number(n.id),
                  title: n.title,
                  year: n.year,
                  citations: n.citations,
                  abstract: n.abstract,
                  author: n.author,
                  local_citations: (n as any).local_citations,
                  subcommunity: n.subcommunity,
                  journal: n.journal,
                  doi: n.doi
                }))
                .sort((a, b) => b.citations - a.citations)
              }
              onClose={() => setSelectedCommunityForDetails(null)}
              scopusApiKey={scopusKey}
              scopusInstToken={instToken}
              onOpenScopusModal={() => setShowScopusKeyModal(true)}
              onOpenContentAnalysis={handleOpenDeepS3}
            />
          )}

          {/* 1. Topic Characterization */}
          <section className="card">
            <div className="card-header">
              <h2>1. Topic Characterization</h2>
              <span className="card-subtitle">
                Global content analysis and community word clouds.
              </span>
            </div>
            <div className="card-body">
              {!csvResult ? (
                <div className="message info">
                  This section will display global topic analysis and community-specific word clouds to characterize the research themes.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: "1rem", padding: "1rem", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #eee" }}>
                    <label className="field-label" style={{ fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span>Number of Communities (Word Clouds): <strong>{numTopicChar}</strong></span>
                      <span style={{ fontSize: "0.8em", color: "#666" }}>Max: {Math.min(50, (csvResult.community_wordcloud_top_terms || []).length)}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max={Math.min(50, (csvResult.community_wordcloud_top_terms || []).length)}
                      value={numTopicChar}
                      onChange={(e) => setNumTopicChar(parseInt(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <details className="info-details" style={{ marginBottom: "1rem" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                      ℹ️ Global Content Analysis
                    </summary>
                    <div className="info-content" style={{ marginTop: "0.5rem" }}>
                      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "300px" }}>
                          <h4 style={{ textAlign: "center", marginBottom: "1rem" }}>TF-IDF Terms</h4>
                          <TagCloud terms={csvResult.wordcloud_top_terms} />
                        </div>
                        <div style={{ flex: 1, minWidth: "300px", borderLeft: "1px solid #eee", paddingLeft: "2rem" }}>
                          <h4 style={{ textAlign: "center", marginBottom: "1rem" }}>Author Keywords</h4>
                          <TagCloud terms={csvResult.keyword_top_terms} />
                        </div>
                      </div>
                    </div>
                  </details>

                  <details className="info-details" style={{ marginTop: "1rem" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                      ℹ️ Community Word Clouds
                    </summary>
                    <div className="info-content" style={{ marginTop: "0.5rem" }}>
                      <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
                        <a
                          href={`${API_BASE}/wordcloud-summary/${(csvResult as any).job_id}?dir=${encodeURIComponent((csvResult as any).job_directory || "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "6px 12px",
                            background: "#007bff",
                            color: "white",
                            borderRadius: "4px",
                            textDecoration: "none",
                            fontSize: "0.9rem",
                            fontWeight: 500
                          }}
                        >
                          📥 Download Summary Image
                        </a>
                      </div>
                      <div className="wordclouds-grid">
                        {csvResult.community_wordcloud_top_terms
                          .slice(0, numTopicChar)
                          .map((wc) => {
                            const keywordData = csvResult.community_keyword_top_terms?.find(k => k.community === wc.community);
                            return (
                              <div key={wc.community} className="wordcloud-item" style={{ maxWidth: "100%" }}>
                                <h4>
                                  Community {wc.community + 1}
                                  {llmLabels[wc.community] ? `: ${llmLabels[wc.community]}` : ""}
                                </h4>
                                <div style={{ display: "flex", gap: "1rem" }}>
                                  <div style={{ flex: 1 }}>
                                    <h6 style={{ textAlign: "center", fontSize: "0.8rem", color: "#666" }}>TF-IDF Terms</h6>
                                    <TagCloud terms={wc.terms} />
                                  </div>
                                  {keywordData && keywordData.terms.length > 0 && (
                                    <div style={{ flex: 1, borderLeft: "1px solid #eee", paddingLeft: "1rem" }}>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                        <h6 style={{ margin: 0, fontSize: "0.8rem", color: "#666" }}>Author Keywords</h6>
                                        <a
                                          href={`${API_BASE}/wordcloud/${(csvResult as any).job_id}/${wc.community}?dir=${encodeURIComponent((csvResult as any).job_directory || "")}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Download Wordcloud Image"
                                          style={{ textDecoration: "none", fontSize: "1rem" }}
                                        >
                                          ⬇️
                                        </a>
                                      </div>
                                      <TagCloud terms={keywordData.terms} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </details>
                </>
              )}
            </div>
          </section>

          {/* 1a. Interactive Map (Live) + Downloads */}
          <section className="card">
            <div className="card-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2>1a. Interactive Map</h2>
                  <span className="card-subtitle">
                    Explore the network directly in your browser. Nodes colored by community.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>

                  {csvResult?.network_gexf_url && (
                    <a
                      href={`${API_BASE}/download/${csvResult.network_gexf_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary-button"
                      style={{
                        textDecoration: "none",
                        fontSize: '0.85rem',
                        padding: '0.4rem 0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                      title="Download GEXF for Gephi/VOSviewer"
                    >
                      📥 GEXF Graph
                    </a>
                  )}
                  {csvResult?.network_html_url && (
                    <a
                      href={`${API_BASE}/download/${csvResult.network_html_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary-button"
                      style={{
                        textDecoration: "none",
                        fontSize: '0.85rem',
                        padding: '0.4rem 0.8rem',
                        background: "var(--accent)",
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                      title="Download Interactive HTML"
                    >
                      🌐 Interactive HTML
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="card-body">
              {!csvResult ? (
                <div className="message info">
                  This section will generate an interactive network graph allowing you to explore connections between individual papers and communities.
                </div>
              ) : (
                <CommunityMap result={csvResult} llmLabels={llmLabels} />
              )}
            </div>
          </section>



          {/* 2c. Citation Flows (Chord) */}
          {csvResult?.chord_diagrams && (
            <section className="card">
              <div className="card-header">
                <h2>2c. Citation Analysis - Cross-Community Flows</h2>
                <span className="card-subtitle">
                  Visualizes citation flows between research communities.
                </span>
              </div>
              <div className="card-body">
                {/* Filter Controls */}
                <div style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <label style={{ fontWeight: 'bold' }}>Top N (Freq & Cited):</label>
                  <input
                    type="range"
                    min="5" max="30"
                    value={chordTopN}
                    onChange={e => setChordTopN(Number(e.target.value))}
                    style={{ width: '150px' }}
                  />
                  <span style={{ minWidth: '30px', fontWeight: 'bold' }}>{chordTopN}</span>

                  <label style={{ fontWeight: 'bold', marginLeft: '1rem' }}>External Edge Threshold:</label>
                  <input
                    type="range"
                    min="1" max="50"
                    value={chordThreshold}
                    onChange={e => setChordThreshold(Number(e.target.value))}
                    style={{ width: '150px' }}
                  />
                  <span style={{ minWidth: '30px', fontWeight: 'bold' }}>{chordThreshold}</span>
                  <button
                    onClick={handleUpdateChord}
                    disabled={isUpdatingChord}
                    className="primary-button"
                    style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }}
                  >
                    {isUpdatingChord ? 'Updating...' : 'Update Diagram'}
                  </button>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.5rem' }}>
                    (Top 10 internal edges are always shown)
                  </div>
                </div>

                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  {chordUrls ? (
                    <>
                      <a
                        href={`${API_BASE}/download/${chordUrls.numeric}?t=${chordTs}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="primary-button"
                        style={{ textDecoration: 'none', padding: '0.5rem 1rem' }}
                      >
                        📊 Open Numeric Diagram (New Tab)
                      </a>
                      <a
                        href={`${API_BASE}/download/${chordUrls.topic}?t=${chordTs}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="primary-button"
                        style={{ textDecoration: 'none', padding: '0.5rem 1rem', background: 'var(--accent)' }}
                      >
                        📊 Open Topic Diagram (New Tab)
                      </a>
                    </>
                  ) : (
                    <div>Loading diagrams...</div>
                  )}
                </div>


                <hr style={{ margin: '1.5rem 0', border: '0', borderTop: '1px solid #eee' }} />

                <div style={{ padding: '1rem', width: '100%' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'white' }}>Underlying Citation Matrix</h3>
                  {(currentUsecase || csvResult?.job_id) && (
                    <CitationMatrix
                      usecase={currentUsecase || ''}
                      jobId={csvResult?.job_id}
                      onCommunityClick={handleCommunityClick}
                    />
                  )}
                </div>

              </div>
            </section>
          )}


          {/* 2. Citation Analysis */}
          <section className="card">
            <div className="card-header">
              <h2>2. Citation Analysis</h2>
              <span className="card-subtitle">
                Local citation confusion matrix between top 10 communities.
              </span>
            </div>
            <div className="card-body">
              {!csvResult ? (
                <div className="message info">
                  This section will provide a confusion matrix and detailed citation metrics to analyze the relationships between different communities.
                </div>
              ) : (
                <>
                  {/* Top N slider removed, handled by CitationMatrix component */}
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", alignItems: "center" }}>
                    <button
                      onClick={() => setShowScopusKeyModal(true)}
                      style={{
                        padding: "0.5rem 1rem",
                        background: "#f0f0f0",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.9rem"
                      }}
                    >
                      Search Scopus References
                    </button>
                  </div>

                  <div className="pill-row">
                    <StatPill
                      label="Local links"
                      value={csvResult.local_citations_stats?.num_links ?? 0}
                    />
                    <StatPill
                      label="Unique pairs"
                      value={csvResult.local_citations_stats?.num_unique_pairs ?? 0}
                    />
                  </div>
                  <details className="info-details" style={{ marginBottom: "1rem" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                      ℹ️ Confusion Matrix
                    </summary>
                    <div className="info-content" style={{ marginTop: "0.5rem" }}>
                      <CitationMatrix
                        usecase={currentUsecase}
                        forcedTopN={chordTopN}
                        onCommunityClick={handleCommunityClick}
                      />
                    </div>
                  </details>



                  <details className="info-details" style={{ marginBottom: "1rem" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                      ℹ️ Table 2: Quantitative Assessment of Community Attributes and Topic Modeling Quality
                    </summary>
                    <div className="info-content" style={{ marginTop: "0.5rem" }}>
                      <div className="table-wrapper">
                        <table className="table small">
                          <thead>
                            <tr>
                              <th>Community</th>
                              <th>Size</th>
                              <th>WithinC</th>
                              <th>OutwardC</th>
                              <th>InwardC</th>
                              <th>QI</th>
                              <th>MI (%)</th>
                              <th>Local citations</th>
                              <th>Global citations</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvResult.community_citation_metrics.slice(0, numCitationAnalysis).map((m) => (
                              <tr key={m.community}>
                                <td>
                                  <strong>{m.community + 1}</strong>
                                  {llmLabels[m.community] && (
                                    <>
                                      <br />
                                      <span style={{ fontSize: "0.85em", color: "var(--accent)" }}>
                                        {llmLabels[m.community]}
                                      </span>
                                    </>
                                  )}
                                </td>
                                <td>{m.size}</td>
                                <td>{m.within_citations}</td>
                                <td>{m.outward_citations}</td>
                                <td>{m.inward_citations}</td>
                                <td>{m.qi.toFixed(1)}</td>
                                <td>{m.mi.toFixed(1)}</td>
                                <td>{m.local_citations}</td>
                                <td>{m.global_citations}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                </>
              )}
            </div>
          </section>

          {/* 2a. Knowledge Tree (Citation Flows) */}
          <section className="card">
            <div className="card-header">
              <h2>2a. Knowledge Tree</h2>
              <span className="card-subtitle">
                Citation flows as Implicit Knowledge Tree flow over time.
              </span>
            </div>
            <div className="card-body">
              {csvResult && 'job_id' in csvResult ? (
                <KnowledgeTree jobId={(csvResult as any).job_id} />
              ) : (
                <div className="message info">Run analysis to view the Knowledge Tree.</div>
              )}
            </div>
          </section>

          {/* 3. Intellectual Structure */}
          <section className="card">
            <div className="card-header">
              <h2>3. Intellectual Structure of the Fields</h2>
              <span className="card-subtitle">
                Table 3 and Outlier Analysis.
              </span>
            </div>
            <div className="card-body">
              {!csvResult ? (
                <div className="message info">
                  This section will identify foundational papers and outliers to reveal the core intellectual structure of the field.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: "1rem", padding: "1rem", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #eee" }}>
                    <label className="field-label" style={{ fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span>Number of Communities (Table 3): <strong>{numIntellectualStructure}</strong></span>
                      <span style={{ fontSize: "0.8em", color: "#666" }}>Max: {Math.min(50, (csvResult.intellectual_structure || []).length)}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max={Math.min(50, (csvResult.intellectual_structure || []).length)}
                      value={numIntellectualStructure}
                      onChange={(e) => setNumIntellectualStructure(parseInt(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <details className="info-details" style={{ marginBottom: "1rem" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                      ℹ️ Table 3: Top Local and Global Papers within Communities
                    </summary>
                    <div className="info-content" style={{ marginTop: "0.5rem" }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                      </div>
                      <div className="table-wrapper">
                        <table className="table small">
                          <thead>
                            <tr>
                              <th style={{ width: "20%" }}>Community (size & topic)</th>
                              <th style={{ width: "40%" }}>Top 3 local papers</th>
                              <th style={{ width: "40%" }}>Top 3 global papers</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvResult.intellectual_structure.slice(0, numIntellectualStructure).map((item) => (
                              <tr key={item.community_id}>
                                <td>
                                  <div
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleCommunityClick(item.community_id)}
                                    title="View all papers in this community"
                                  >
                                    <strong>ID {item.community_id + 1}</strong> (n={item.size})
                                    {llmLabels[item.community_id] && <span style={{ marginLeft: "0.5rem", color: "var(--accent)", textDecoration: "underline" }}>{llmLabels[item.community_id]}</span>}
                                    <br />
                                    <span className="text-muted">{item.topic}</span>
                                  </div>
                                </td>
                                <td>
                                  <ul className="paper-list">
                                    {item.top_local_papers.map((p, idx) => (
                                      <li key={idx} className="paper-item">
                                        <div className="paper-title">{p.title}</div>
                                        <div className="paper-meta">
                                          {p.year ? `(${p.year})` : ""} Local: {p.local_citations}, Global: {p.global_citations}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                                <td>
                                  <ul className="paper-list">
                                    {item.top_global_papers.map((p, idx) => (
                                      <li key={idx} className="paper-item">
                                        <div className="paper-title">{p.title}</div>
                                        <div className="paper-meta">
                                          {p.year ? `(${p.year})` : ""} Global: {p.global_citations}, Local: {p.local_citations}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>

                  <details className="info-details" style={{ marginTop: "1rem" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                      ℹ️ Analysis of Outliers
                    </summary>
                    <div className="info-content" style={{ marginTop: "0.5rem" }}>
                      <p className="small text-muted">
                        Top cited papers that are not strongly connected to the main topics.
                      </p>

                      {!csvResult.outliers || csvResult.outliers.length === 0 ? (
                        <div className="message info">
                          No outliers found. All papers are well-connected.
                        </div>
                      ) : (
                        <OutlierTable
                          outliers={csvResult.outliers || []}
                          communities={csvResult.communities || []}
                          onAssignToCommunity={async (paperId, communityId) => {
                            const jobId = ('job_id' in csvResult) ? (csvResult as any).job_id : "";
                            if (!jobId) {
                              alert("Missing Job ID");
                              return;
                            }
                            try {
                              await assignOutlier(jobId, paperId, communityId);
                              // Optimistic update
                              setCsvResult((prev) => {
                                if (!prev || !prev.outliers) return prev;
                                return {
                                  ...prev,
                                  outliers: prev.outliers.filter((o) => o.id !== paperId),
                                };
                              });
                              alert(`Paper assigned to Community ${communityId + 1} successfully.`);
                            } catch (err: any) {
                              alert("Failed to assign paper: " + err.message);
                            }
                          }}
                        />
                      )}

                    </div>
                  </details>
                </>
              )}
            </div>
          </section>

          {/* Advanced Analysis Wrapper */}
          <details style={{ marginBottom: "2rem", width: "100%" }}>
            <summary className="primary-button" style={{ cursor: "pointer", display: "inline-block", padding: "0.75rem 1.5rem", borderRadius: "4px", fontSize: "1.1rem", fontWeight: "bold" }}>
              Advanced Analysis
            </summary>
            <div style={{ marginTop: "1.5rem" }}>
              {/* Directed Community Detection */}
              <section className="card">
                <div className="card-header">
                  <h2>Directed Community Detection</h2>
                  <span className="card-subtitle">
                    Uses the Leiden algorithm and directed modularity to detect communities.
                  </span>
                </div>
                <div className="card-body">
                  {!csvResult?.directed_communities ? (
                    <div className="message info">
                      Run the analysis pipeline to view the directed community detection results.
                    </div>
                  ) : (
                    <>
                      <div className="info-details" style={{ marginBottom: "1rem", padding: "1rem", background: "#f8f9fa", borderRadius: "8px" }}>
                        <h3 style={{ marginTop: 0 }}>Methodology</h3>
                        <p>This section uses directed community detection based on the following directed modularity formula:</p>
                        <div style={{ padding: "1rem", background: "#fff", border: "1px solid #ddd", borderRadius: "4px", overflowX: "auto", fontFamily: "monospace", fontSize: "1.1rem", textAlign: "center", marginBottom: "1rem" }}>
                          M = (1 / m) ∑_ij (S3_ij - (k_i^out * k_j^in) / m) δ(c_i, c_j)
                        </div>
                        <p><strong>Note:</strong> Normalization is 1/m (not 1/2m), and the null model uses out-degree of source × in-degree of target.</p>
                        <h4 style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>Citations:</h4>
                        <ul style={{ paddingLeft: "1.5rem", marginBottom: 0 }}>
                          <li>Leicht, E. A., & Newman, M. E. (2008). Community structure in directed networks. Physical review letters, 100(11), 118703.</li>
                          <li>Traag, V. A., Waltman, L., & van Eck, N. J. (2019). From Louvain to Leiden: guaranteeing well-connected communities. Scientific reports, 9(1), 1-12.</li>
                        </ul>
                      </div>

                      <details className="info-details" style={{ marginBottom: "1rem" }}>
                        <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                          ℹ️ Table 2: Quantitative Assessment of Community Attributes and Topic Modeling Quality
                        </summary>
                        <div className="info-content" style={{ marginTop: "0.5rem" }}>
                          <div className="table-wrapper">
                            <table className="table small">
                              <thead>
                                <tr>
                                  <th>Community</th>
                                  <th>Size</th>
                                  <th>WithinC</th>
                                  <th>OutwardC</th>
                                  <th>InwardC</th>
                                  <th>QI</th>
                                  <th>MI (%)</th>
                                  <th>Local citations</th>
                                  <th>Global citations</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(csvResult.directed_community_citation_metrics || []).map((m: any) => (
                                  <tr key={m.community}>
                                    <td><strong>{m.community + 1}</strong></td>
                                    <td>{m.size}</td>
                                    <td>{m.within_citations}</td>
                                    <td>{m.outward_citations}</td>
                                    <td>{m.inward_citations}</td>
                                    <td>{m.qi.toFixed(1)}</td>
                                    <td>{m.mi.toFixed(1)}</td>
                                    <td>{m.local_citations}</td>
                                    <td>{m.global_citations}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </details>

                      <details className="info-details" style={{ marginBottom: "1rem" }}>
                        <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                          ℹ️ Topic Modeling (Directed Community Word Clouds)
                        </summary>
                        <div className="info-content" style={{ marginTop: "0.5rem" }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                            {(csvResult.directed_wordcloud_top_terms || []).slice(0, 10).map((cwt: any, idx: number) => (
                              <div key={idx} style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}>
                                <h4 style={{ marginTop: 0, textAlign: 'center', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>Comm {cwt.community + 1}</h4>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.9rem' }}>
                                  {cwt.terms.slice(0, 10).map((t: any, i: number) => (
                                    <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                      <span>{t.term}</span>
                                      <span style={{ color: '#888' }}>{t.weight.toFixed(2)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>

                      <details className="info-details" style={{ marginBottom: "1rem" }}>
                        <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                          ℹ️ Confusion Matrix for Citation Analysis
                        </summary>
                        <div className="info-content" style={{ marginTop: "0.5rem", overflowX: "auto" }}>
                          {!!(csvResult.directed_citation_confusion_matrix?.matrix?.length) ? (
                            <table className="table small" style={{ minWidth: "600px" }}>
                              <thead>
                                <tr>
                                  <th>From \ To</th>
                                  {csvResult.directed_citation_confusion_matrix!.community_ids.map((id: number) => (
                                    <th key={id} title={`Community ${id + 1}`}>C{id + 1}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {csvResult.directed_citation_confusion_matrix!.matrix.map((row: number[], i: number) => (
                                  <tr key={i}>
                                    <th>C{csvResult.directed_citation_confusion_matrix!.community_ids[i] + 1}</th>
                                    {row.map((val: number, j: number) => {
                                      const isDiagonal = i === j;
                                      return (
                                        <td key={j} style={{
                                          textAlign: "center",
                                          backgroundColor: isDiagonal ? "rgba(46, 204, 113, 0.15)" : (val > 0 ? "rgba(52, 152, 219, 0.1)" : "transparent"),
                                          fontWeight: isDiagonal ? "bold" : "normal"
                                        }}>
                                          {val}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="message info">No citation matrix data available for the directed graph.</div>
                          )}
                        </div>
                      </details>
                    </>
                  )}
                </div>
              </section>

              {/* 4. Community Overview & Detailed Analysis */}
              <section className="card">
                <div className="card-header">
                  <h2>4. Community Overview & Detailed Analysis</h2>
                  <span className="card-subtitle">
                    Comprehensive analysis of communities, including RQs, funding, and journals.
                  </span>
                </div>
                <div className="card-body">
                  {!csvResult ? (
                    <div className="message info">
                      This section will offer a deep dive into each community including top institutions, funding sources, and author analysis.
                    </div>
                  ) : (
                    <>
                      <CommunitiesOverview
                        result={csvResult}
                        llmLabels={llmLabels}
                      />

                      {/* Interdisciplinary Analysis - Moved after Knowledge Graph Insights */}
                      <details className="info-details" style={{ marginTop: "1rem" }}>
                        <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                          ℹ️ Interdisciplinary Analysis
                        </summary>
                        <div className="info-content" style={{ marginTop: "1rem" }}>
                          {!showInterdisciplinary ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                              <button onClick={() => setShowInterdisciplinary(true)} style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '1rem',
                                backgroundColor: 'var(--accent)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}>
                                See Interdisciplinary Analysis
                              </button>
                            </div>
                          ) : (csvResult.interdisciplinary_analysis &&
                            typeof csvResult.interdisciplinary_analysis === 'object' &&
                            (csvResult.interdisciplinary_analysis.affiliations_by_community ||
                              csvResult.interdisciplinary_analysis.sources_by_community ||
                              csvResult.interdisciplinary_analysis.communities_by_source)) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                  className="secondary-button"
                                  onClick={() => { setModalMode('cleaning'); setShowApiKeyModal(true); }}
                                  disabled={isCleaningData}
                                  title="Use LLM to merge duplicate affiliation/source names"
                                  style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}
                                >
                                  {isCleaningData ? "Cleaning Data..." : "✨ Clean Data with LLM"}
                                </button>
                              </div>
                              <div style={{ marginBottom: "1rem", padding: "0.5rem", background: "#f8f9fa", borderRadius: "4px" }}>
                                <label className="field-label" style={{ fontWeight: 500, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                  <span>Number of Communities: <strong>{numInterdisciplinary}</strong></span>
                                  <span style={{ fontSize: "0.8em", color: "#666" }}>Max: {Math.min(50, (csvResult.communities || []).length)}</span>
                                </label>
                                <input
                                  type="range"
                                  min="1"
                                  max={Math.min(50, (csvResult.communities || []).length)}
                                  value={numInterdisciplinary}
                                  onChange={(e) => setNumInterdisciplinary(parseInt(e.target.value))}
                                  style={{ width: "100%" }}
                                />
                              </div>
                              {/* 1. Affiliations */}
                              {csvResult.interdisciplinary_analysis?.affiliations_by_community && (csvResult.interdisciplinary_analysis.affiliations_by_community || []).length > 0 && (
                                <div>
                                  <h4>Distributions of Communities Within Top Affiliations</h4>
                                  <div style={{ height: 500 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart
                                        layout="vertical"
                                        data={csvResult.interdisciplinary_analysis.affiliations_by_community}
                                        margin={{ top: 20, right: 30, left: 200, bottom: 5 }}
                                      >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                        <XAxis type="number" stroke="#ccc" />
                                        <YAxis dataKey="name" type="category" width={180} stroke="#ccc" interval={0} fontSize={11} tick={{ fill: '#ccc' }} />
                                        <Tooltip contentStyle={{ backgroundColor: "#333", border: "1px solid #555", color: "#eee" }} itemStyle={{ color: "#eee" }} />
                                        <Legend />
                                        {(csvResult.interdisciplinary_analysis.community_keys || csvResult.communities.slice(0, numInterdisciplinary)).map((c: any, i: number) => {
                                          const id = 'id' in c ? c.id : c.id;
                                          const key = 'key' in c ? c.key : `comm_${id}`;
                                          return (
                                            <Bar key={key} dataKey={key} name={llmLabels[id] || `Comm ${id}`} stackId="a" fill={COLORS[i % COLORS.length]} />
                                          );
                                        })}
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              )}

                              {/* 2. Sources */}
                              {csvResult.interdisciplinary_analysis?.sources_by_community && (csvResult.interdisciplinary_analysis.sources_by_community || []).length > 0 && (
                                <div>
                                  <h4>Distributions of Communities Within Top Sources</h4>
                                  <div style={{ height: 500 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart
                                        layout="vertical"
                                        data={csvResult.interdisciplinary_analysis.sources_by_community}
                                        margin={{ top: 20, right: 30, left: 200, bottom: 5 }}
                                      >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                        <XAxis type="number" stroke="#ccc" />
                                        <YAxis dataKey="name" type="category" width={180} stroke="#ccc" interval={0} fontSize={11} tick={{ fill: '#ccc' }} />
                                        <Tooltip contentStyle={{ backgroundColor: "#333", border: "1px solid #555", color: "#eee" }} itemStyle={{ color: "#eee" }} />
                                        <Legend />
                                        {(csvResult.interdisciplinary_analysis.community_keys || csvResult.communities.slice(0, numInterdisciplinary)).map((c: any, i: number) => {
                                          const id = 'id' in c ? c.id : c.id;
                                          const key = 'key' in c ? c.key : `comm_${id}`;
                                          return (
                                            <Bar key={key} dataKey={key} name={llmLabels[id] || `Comm ${id}`} stackId="a" fill={COLORS[i % COLORS.length]} />
                                          );
                                        })}
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              )}

                              {/* 3. Communities by Source */}
                              {csvResult.interdisciplinary_analysis?.communities_by_source && (csvResult.interdisciplinary_analysis.communities_by_source || []).length > 0 && (
                                <div>
                                  <h4>Distributions of Sources Within Each Community</h4>
                                  <div style={{ height: 500 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart
                                        layout="vertical"
                                        data={csvResult.interdisciplinary_analysis.communities_by_source}
                                        margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                                      >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                        <XAxis type="number" stroke="#ccc" />
                                        <YAxis dataKey="name" type="category" width={100} stroke="#ccc" interval={0} fontSize={12} tick={{ fill: '#ccc' }} />
                                        <Tooltip contentStyle={{ backgroundColor: "#333", border: "1px solid #555", color: "#eee" }} itemStyle={{ color: "#eee" }} />
                                        {csvResult.interdisciplinary_analysis.source_keys ? (
                                          csvResult.interdisciplinary_analysis.source_keys.map((sk: any, i: number) => (
                                            <Bar key={sk.key} dataKey={sk.key} name={sk.label} stackId="a" fill={COLORS[(i + 5) % COLORS.length]} />
                                          ))
                                        ) : (
                                          Object.keys(csvResult.interdisciplinary_analysis.communities_by_source[0] || {})
                                            .filter((k: string) => k !== 'name')
                                            .map((key: string, i: number) => (
                                              <Bar key={key} dataKey={key} stackId="a" fill={COLORS[(i + 5) % COLORS.length]} />
                                            ))
                                        )}
                                        <Legend />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="message info">No interdisciplinary analysis available.</div>
                          )}
                        </div>
                      </details>

                      {/* Funding Analysis */}
                      <details className="info-details" style={{ marginTop: "1rem" }}>
                        <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                          ℹ️ Funding Analysis
                        </summary>
                        <div className="info-content" style={{ marginTop: "0.5rem" }}>
                          {!csvResult.rq10 || (csvResult.rq10 || []).length === 0 ? (
                            <div className="message info">
                              No funding data available. Ensure "Funding Details" or "Funding Text" column exists.
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                              {csvResult.rq10.map((item, idx) => (
                                <div key={idx} style={{ flex: "1 1 45%", border: "1px solid #eee", padding: "1rem", borderRadius: "8px" }}>
                                  <h5 style={{ textAlign: "center", marginBottom: "0.5rem" }}>{item.agency}</h5>
                                  <table className="table small">
                                    <thead>
                                      <tr>
                                        <th>Community</th>
                                        <th>Papers Funded</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.topics.map((t, i) => (
                                        <tr key={i}>
                                          <td>
                                            Community {t.community + 1}
                                            {llmLabels[t.community] ? <br /> : null}
                                            {llmLabels[t.community] && <small>{llmLabels[t.community]}</small>}
                                          </td>
                                          <td>{t.count}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </details>

                      {/* Journal Analysis */}
                      <details className="info-details" style={{ marginTop: "1rem" }}>
                        <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--accent)" }}>
                          ℹ️ Journal Analysis
                        </summary>
                        <div className="info-content" style={{ marginTop: "0.5rem" }}>
                          {!csvResult.rq11 || ((csvResult.rq11.top_journals_countries || []).length === 0 && (csvResult.rq11.top_communities_journals || []).length === 0) ? (
                            <div className="message info">
                              No journal data available. Ensure "Source Title" column exists.
                            </div>
                          ) : (
                            <div>
                              {/* Top Journals & Countries */}
                              <div style={{ marginBottom: "2rem" }}>
                                <h4 style={{ textAlign: "center", marginBottom: "1rem" }}>Top 5 Journals & Country Distribution</h4>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                                  {csvResult.rq11.top_journals_countries.map((item, idx) => (
                                    <div key={idx} style={{ flex: "1 1 30%", border: "1px solid #eee", padding: "1rem", borderRadius: "8px", minWidth: "250px" }}>
                                      <h5 style={{ textAlign: "center", marginBottom: "0.5rem", fontSize: "0.9rem" }}>{item.journal}</h5>
                                      <table className="table small">
                                        <thead>
                                          <tr>
                                            <th>Country</th>
                                            <th>Count</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {item.countries.map((c, i) => (
                                            <tr key={i}>
                                              <td>{c.country}</td>
                                              <td>{c.count}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Community Journals */}
                              <div>
                                <h4 style={{ textAlign: "center", marginBottom: "1rem" }}>Journal Distribution in Top 5 Communities</h4>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                                  {csvResult.rq11.top_communities_journals.map((item, idx) => (
                                    <div key={idx} style={{ flex: "1 1 45%", border: "1px solid #eee", padding: "1rem", borderRadius: "8px", minWidth: "300px" }}>
                                      <h5 style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                                        Community {item.community + 1}
                                        {llmLabels[item.community] ? `: ${llmLabels[item.community]}` : ""}
                                      </h5>
                                      <table className="table small">
                                        <thead>
                                          <tr>
                                            <th>Journal</th>
                                            <th>Count</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {item.journals.map((j, i) => (
                                            <tr key={i}>
                                              <td>{j.journal}</td>
                                              <td>{j.count}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    </>
                  )}
                </div>
              </section>

              {/* 5. Science of Science */}
              <section className="card">
                <div className="card-header">
                  <h2>5. Science of Science</h2>
                  <span className="card-subtitle">
                    Advanced analysis of scientific impact, collaboration, and evolution.
                  </span>
                </div>
                <div className="card-body">
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ marginBottom: '1rem', color: 'var(--text-soft)' }}>
                      Load the "COO" (Country of Origin) usecase to visualize Science of Science data.
                      Results will appear in the dashboard above.
                    </p>
                    <button
                      className="primary-button"
                      onClick={handleLoadCOO}
                      disabled={isUploadingCsv}
                    >
                      🌐 Load "COO" Usecase
                    </button>
                    {currentUsecase === 'coo' && (
                      <p style={{ marginTop: '1rem', color: '#2ecc71', fontWeight: 'bold' }}>
                        ✓ COO Usecase Active
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </details>
        </main>
      </div>
      {
        showApiKeyModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }}>
            <div className="card" style={{ padding: '2rem', maxWidth: '550px', width: '90%', backgroundColor: 'var(--bg-card)' }}>
              <h3 style={{ marginTop: 0 }}>
                {modalMode === 'labeling' ? "Generate Topic Labels" : "Clean Data with LLM"}
              </h3>

              {/* Topic Modeling Parameters - Only show for labeling */}
              {modalMode === 'labeling' && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                  <h4 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.95rem' }}>Topic Modeling Parameters</h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                        Top Papers per Window
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={topPapersPerWindow}
                        onChange={(e) => setTopPapersPerWindow(parseInt(e.target.value) || 2)}
                        className="field-input"
                        style={{ width: '100%' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem' }}>
                        Most cited papers per time window
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                        Window Size (years)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={topicWindowSize}
                        onChange={(e) => setTopicWindowSize(parseInt(e.target.value) || 2)}
                        className="field-input"
                        style={{ width: '100%' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem' }}>
                        Time window for sliding analysis
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                        Period Start (optional)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g., 2000"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value ? parseInt(e.target.value) : "")}
                        className="field-input"
                        style={{ width: '100%' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem' }}>
                        Filter papers from this year
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                        Period End (optional)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g., 2025"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value ? parseInt(e.target.value) : "")}
                        className="field-input"
                        style={{ width: '100%' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem' }}>
                        Filter papers until this year
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                        Max Papers for LLM
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={maxPapersForLlm}
                        onChange={(e) => setMaxPapersForLlm(parseInt(e.target.value) || 10)}
                        className="field-input"
                        style={{ width: '100%' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem' }}>
                        Maximum papers per community context
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                        Number of Communities
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={topNCommunities}
                        onChange={(e) => setTopNCommunities(parseInt(e.target.value) || 50)}
                        className="field-input"
                        style={{ width: '100%' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem' }}>
                        Analyze top N largest communities
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Model Type Selection */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Model Type</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      value="gemini"
                      checked={modelType === "gemini"}
                      onChange={(e) => setModelType(e.target.value as "gemini" | "local")}
                      style={{ marginRight: '0.5rem' }}
                    />
                    Gemini API
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      value="local"
                      checked={modelType === "local"}
                      onChange={(e) => setModelType(e.target.value as "gemini" | "local")}
                      style={{ marginRight: '0.5rem' }}
                    />
                    Local Model
                  </label>
                </div>
              </div>

              {/* Gemini API Key Input */}
              {modelType === "gemini" && (
                <>
                  <p style={{ marginBottom: '1rem', color: 'var(--text-soft)', fontSize: '0.9rem' }}>
                    The API key is sent securely to the server for this request only and is not stored permanently.
                  </p>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API Key (AIza...)"
                    className="field-input"
                    style={{ width: '100%', marginBottom: '1.5rem' }}
                  />
                </>
              )}

              {/* Local Model Configuration */}
              {modelType === "local" && (
                <>
                  <p style={{ marginBottom: '1rem', color: 'var(--text-soft)', fontSize: '0.9rem' }}>
                    ⚠️ Local models require significant GPU memory (32-64GB VRAM for Qwen/QwQ-32B).
                    Model will be loaded from your local Hugging Face cache or downloaded automatically.
                  </p>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Model Name/Path</label>
                    <input
                      type="text"
                      value={localModelName}
                      onChange={(e) => setLocalModelName(e.target.value)}
                      placeholder="Qwen/QwQ-32B-Preview or models--Qwen--QwQ-32B-Preview"
                      className="field-input"
                      style={{ width: '100%' }}
                    />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginTop: '0.3rem' }}>
                      Enter Hugging Face model name or local path
                    </div>
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={use8bit}
                        onChange={(e) => setUse8bit(e.target.checked)}
                        style={{ marginRight: '0.5rem' }}
                      />
                      Use 8-bit quantization (reduces memory usage by ~50%)
                    </label>
                  </div>
                </>
              )}



              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button className="secondary-button" onClick={() => setShowApiKeyModal(false)}>Cancel</button>
                <button
                  className="primary-button"
                  onClick={modalMode === 'labeling' ? handleGenerateLabels : handleCleanInterdisciplinary}
                  disabled={modelType === "gemini" && !apiKey}
                >
                  {modalMode === 'labeling'
                    ? (isLabeling ? "Generating..." : "Generate Labels")
                    : (isCleaningData ? "Cleaning..." : "Clean Data")
                  }
                </button>
              </div>
            </div>
          </div >
        )
      }
      {
        showScopusKeyModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }}>
            <div className="card" style={{ padding: '2rem', maxWidth: '550px', width: '90%', backgroundColor: 'var(--bg-card)' }}>
              <h3 style={{ marginTop: 0 }}>Enter Scopus API Key</h3>
              <p style={{ marginBottom: "1rem", color: 'var(--text-soft)', fontSize: '0.9rem' }}>
                To fetch EIDs and enhance citation references, the server needs a valid Scopus API Key.
              </p>

              <div style={{
                background: "#f9f9f9",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1.5rem",
                fontSize: "0.9rem",
                lineHeight: "1.5"
              }}>
                <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Access Requirements:</strong>
                <ul style={{ paddingLeft: "1.5rem", margin: 0 }}>
                  <li>Your institution must subscribe to the Scopus API</li>
                  <li>Register API keys at <a href="https://dev.elsevier.com/apikey/manage" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>dev.elsevier.com/apikey/manage</a></li>
                  <li>You must be:
                    <ul style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                      <li>In your institution's network, OR</li>
                      <li>Using your institution's VPN, OR</li>
                      <li>Using an InstToken (for remote access without VPN)</li>
                    </ul>
                  </li>
                </ul>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>API Key</label>
                <input
                  type="password"
                  value={scopusKey}
                  onChange={(e) => setScopusKey(e.target.value)}
                  placeholder="Enter Scopus API Key..."
                  className="field-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Institutional Token (InstToken)
                </label>
                <input
                  type="password"
                  value={instToken}
                  onChange={(e) => setInstToken(e.target.value)}
                  placeholder="Enter InstToken (optional)..."
                  className="field-input"
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginTop: '0.3rem' }}>
                  Optional. Required only if you are working off-campus without VPN.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button className="secondary-button" onClick={() => setShowScopusKeyModal(false)}>Cancel</button>
                <button
                  className="primary-button"
                  onClick={handleEnhanceCitations}
                  disabled={!scopusKey || isEnhancing}
                >
                  {isEnhancing ? "Starting..." : "Start Enrichment"}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        isPdfManagerOpen && csvResult && (
          <PDFManagerModal
            jobId={(csvResult as any).job_id || ""}
            isOpen={isPdfManagerOpen}
            onClose={() => {
              setIsPdfManagerOpen(false);
              setPdfManagerFilterIds(null); // Clear filter on close
            }}
            filterIds={pdfManagerFilterIds}
          />
        )
      }

      {/* Deep S3 Content Analysis Modal (Global) */}
      {
        isDeepS3Open && deepS3Params && (
          <ContentAnalysisModal
            isOpen={isDeepS3Open}
            onClose={() => setIsDeepS3Open(false)}
            jobId={deepS3Params.jobId}
            communityId={deepS3Params.communityId}
            communityName={deepS3Params.communityName}
            selectedPaperIds={deepS3Params.selectedPaperIds}
            preSelectedPapersCount={deepS3Params.preSelectedPapersCount}
            availablePapers={(() => {
              // Extract papers for this community from the global graph
              if (!csvResult) return [];
              const commId = deepS3Params.communityId;
              const nodes = csvResult.paper_network?.nodes || csvResult.graph_overview?.nodes || [];
              // Map to PaperCompact
              // Note: graph_overview nodes might not have 'year'/'citations' if using old format, 
              // but `paper_network` is preferred.
              // We need to ensure we map correctly.
              return nodes
                .filter((n: any) => n.community === commId)
                .map((n: any) => ({
                  id: typeof n.id === 'string' ? parseInt(n.id) : n.id,
                  title: n.title || "Untitled",
                  year: n.year,
                  citations: n.citations || 0
                }))
                .sort((a, b) => b.citations - a.citations); // Sort by citations desc
            })()}
          />
        )
      }



    </div >
  );
};

const App: React.FC<{ googleAuthEnabled: boolean }> = ({ googleAuthEnabled }) => {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <MainContent googleAuthEnabled={googleAuthEnabled} />
      </ErrorBoundary>
    </AuthProvider>
  );
};

export default App;
