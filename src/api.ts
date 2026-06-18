// src/api.ts
import { withAuthHeaders } from './authToken';
export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = {};
  if (text) {
    try { data = JSON.parse(text); } catch { /* non-JSON body */ }
  }

  if (!res.ok) {
    const detail = data && typeof data === "object"
      ? (data.detail || data.message)
      : undefined;
    // statusText is "" on HTTP/2, so never rely on it alone.
    const message = detail
      ? String(detail)
      : `HTTP ${res.status}${res.statusText ? " " + res.statusText : ""} from ${res.url}` +
        (text ? ` – ${text.slice(0, 200)}` : " (empty body)");
    throw Object.assign(new Error(message), { status: res.status, url: res.url });
  }

  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: withAuthHeaders(),
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: withAuthHeaders(body ? { "Content-Type": "application/json" } : undefined),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

// ---------- core types ----------

export interface Stats {
  nodes: number;
  edges: number;
  paper_nodes: number;
  similarity_edges: number;
}

export interface Community {
  paper_community: string;
  paper_community_topic: string;
  n_papers: number;
}

export interface SearchResult {
  eid: string;
  title: string;
  score: number;
  abstract: string;
}

// ---------- CSV / S3 pipeline types ----------

export interface CsvGraphNode {
  id: number;
  size: number;
}

export interface CsvGraphEdge {
  source: number;
  target: number;
  weight: number;
}

export interface GraphOverview {
  nodes: CsvGraphNode[];
  edges: CsvGraphEdge[];
}

export interface CommunityCitation {
  id: number;
  n_papers: number;
  total_citations: number;
  mean_citations: number;
}

export interface TopCitedPaper {
  title: string;
  year: number | null;
  cited_by: number;
  community: number | null;
  local_citations?: number;
}

export interface WordcloudTerm {
  term: string;
  weight: number;
}

export interface CommunityWordcloud {
  community: number;
  terms: WordcloudTerm[];
}

export interface YearBin {
  year: number;
  count: number;
}

export interface CitationConfusionMatrix {
  community_ids: number[];
  matrix: number[][];
}

export interface CommunityCitationMetric {
  community: number;
  size: number;
  within_citations: number;
  outward_citations: number;
  inward_citations: number;
  qi: number;
  mi: number;
  local_citations: number;
  global_citations: number;
}

export interface AuthorTopicBipartiteEdge {
  author_index: number;
  topic_index: number;
  weight: number;
}

export interface AuthorTopicBipartite {
  authors: string[];
  topics: string[];
  edges: AuthorTopicBipartiteEdge[];
}

export interface InterdisciplinaryAnalysis {
  affiliations_by_community?: Record<string, any>[];
  sources_by_community?: Record<string, any>[];
  communities_by_source?: Record<string, any>[];
  source_keys?: { key: string; label: string }[];
  community_keys?: { key: string; id: number }[];
}

export interface AuthorRFIRow {
  author: string;
  R_raw: number | null;
  F_raw: number;
  I_raw: number;
  R_score: number;
  F_score: number;
  I_score: number;
  total_score: number;
  last_year: number | null;
}

export interface AuthorRFIResult {
  global_top_10: AuthorRFIRow[];
  community_top_5: {
    community: number;
    authors: AuthorRFIRow[];
  }[];
}

export interface CoCitationEdge {
  source: string;
  target: string;
  weight: number;
  source_deg: number;
  target_deg: number;
  jaccard?: number;
}

export interface CoCitationNode {
  id: string;
  count: number;
}

export interface CoCitationResult {
  edges?: CoCitationEdge[];
  nodes?: CoCitationNode[];
}

export interface ValidationStat {
  method: string;
  edge_threshold?: number;
  min_comm_size?: number;
  TP: number;
  FP: number;
  FN: number;
  TN: number;
  Precision: number;
  Recall: number;
  F1: number;
  FP_papers?: {
    eid: string;
    title: string;
    authors?: string;
    year?: number | null;
    citations?: number;
    abstract?: string;
    bc_score?: number;
    cc_score?: number;
  }[];
  FN_papers?: {
    eid: string;
    title: string;
    authors?: string;
    year?: number | null;
    citations?: number;
    abstract?: string;
    bc_score?: number;
    cc_score?: number;
  }[];
}

export interface ValidationPairwise {
  method: string;
  pair_TP: number;
  pair_FP: number;
  pair_FN: number;
  pair_precision: number;
  pair_recall: number;
  pair_f1: number;
}

export interface CsvAnalysisResult {
  job_id: string;
  filename?: string; // Passed from job status
  n_papers: number;
  truncated: boolean;
  year_min: number | null;
  year_max: number | null;
  embedding_dim: number;

  s3_stats: {
    min: number | null;
    max: number | null;
    mean: number | null;
  };
  // ...
  // I can't easily replace the whole interface start without re-typing it all.
  // Instead, I'll add the interface separately and add the field at the END of CsvAnalysisResult.


  s3_sample: number[][];

  threshold_scan: {
    threshold: number;
    silhouette: number;
    n_papers: number;
    sii: number;
    modularity?: number;
    n_communities?: number;
  }[];

  best_threshold: number | null;
  best_threshold_stats: {
    threshold: number;
    silhouette: number;
    n_papers: number;
  } | null;

  optimal_k_elbow?: number | null;
  elbow_threshold?: number | null;

  communities: {
    id: number;
    n_papers: number;
  }[];

  top_papers_per_community: {
    community: number;
    title: string;
    year: number | null;
    cited_by: number;
    eigen_centrality: number;
  }[];

  graph_overview: GraphOverview;

  community_citations: CommunityCitation[];

  top_cited_papers: TopCitedPaper[];

  wordcloud_top_terms: WordcloudTerm[];
  keyword_top_terms: WordcloudTerm[];
  community_wordcloud_top_terms: CommunityWordcloud[];
  community_keyword_top_terms: CommunityWordcloud[];

  year_distribution: YearBin[];

  citation_confusion_matrix: CitationConfusionMatrix;

  community_citation_metrics: CommunityCitationMetric[];
  total_field_citations: number;
  author_topic_bipartite: AuthorTopicBipartite | null;
  local_citations_stats: {
    num_links: number;
    num_unique_pairs: number;
  } | null;

  chord_diagrams?: {
    numeric: string;
    topic: string;
  };

  intellectual_structure: {
    community_id: number;
    size: number;
    topic: string;
    top_local_papers: {
      title: string;
      year: number | null;
      local_citations: number;
      global_citations: number;
    }[];
    top_global_papers: {
      title: string;
      year: number | null;
      local_citations: number;
      global_citations: number;
    }[];
  }[];


  graph_insights: {
    modularity: number;
    global_density: number;
    top_degree: { id: number; title: string; score: number; community: number }[];
    top_eigenvector: { id: number; title: string; score: number; community: number }[];
    top_betweenness: { id: number; title: string; score: number; community: number }[];
    similarity_matrix?: {
      community_ids: number[];
      matrix: number[][];
    };
    temporal_insights?: {
      id: number;
      stats: { mean: number; median: number; min: number; max: number };
      distribution: { year: number; count: number }[];
    }[];
    community_wordcloud_top_terms?: { community: number; terms: { term: string; weight: number }[] }[];
    community_keyword_top_terms?: { community: number; terms: { term: string; weight: number }[] }[];
    year_distribution?: { year: number; count: number }[];
    word_evolution?: {
      word: string;
      distribution: { year: number; count: number }[];
    }[];
    topic_evolution?: {
      windows: { start: number; end: number; label: string }[];
      topics: {
        window_idx: number;
        topic_id: number;
        size: number;
        citations: number;
        centrality: number;
        rank_score: number;
        keywords: string[];
      }[];
      lineage: { source: string; target: string; weight: number }[];
      events: { window: string; type: string; description: string }[];
    };
    author_topic_network?: {
      top_authors: string[];
      top_communities: number[];
      matrix: { author: string; counts: number[] }[];
      author_projection?: number[][];
      topic_projection?: number[][];
    };
    country_topic_network?: {
      top_countries: string[];
      top_communities: number[];
      matrix: number[][];
      country_projection: number[][];
      topic_projection: number[][];
    };
    kg_questions?: {
      rq1: { community: number; n_papers: number }[];
      rq2: { community: number; papers: { eid: string; title: string; year: number | null; citations: number }[] }[];
      rq3: { author: string; n_communities: number; communities: number[] }[];
      rq4: { source: number; target: number; semantic_weight: number; citation_count: number }[];
      rq5: { concept: string; year_dist: Record<string, number>; comm_dist: Record<string, number> }[];
      rq6: {
        source: number;
        target: number;
        shared_authors: number;
        semantic_weight: number;
      }[];
      rq7?: {
        community: number;
        institutions: {
          institution: string;
          country: string;
          count: number;
        }[];
      }[];
      rq8?: {
        community: number;
        countries: {
          country: string;
          count: number;
        }[];
      }[];
      rq9?: {
        global: {
          year: number;
          [country: string]: number;
        }[];
        communities: {
          community: number;
          data: {
            year: number;
            [country: string]: number;
          }[];
          top_countries: string[];
        }[];
      };
    };
    author_rfi?: AuthorRFIResult;
    kg_status?: {
      success: boolean;
      message: string;
    };
  };

  rq10?: {
    agency: string;
    topics: {
      community: number;
      count: number;
    }[];
  }[];
  outliers?: {
    id: number;
    title: string;
    citations: number;
    year: number | null;
    authors: string;
    abstract?: string;
    inclusion_threshold?: number;
    suggested_community?: number | null;
  }[];
  rq11?: {
    top_journals_countries: {
      journal: string;
      countries: {
        country: string;
        count: number;
      }[];
    }[];
    top_communities_journals: {
      community: number;
      journals: {
        journal: string;
        count: number;
      }[];
    }[];
  };

  method_comparison?: {
    methods: string[];
    correlation_matrix: number[][];
    overlap_matrix: number[][];
  };

  co_citation?: CoCitationResult;
  validation_stats?: ValidationStat[];
  validation_pairwise?: ValidationPairwise[];

  community_dendrogram?: {
    linkage: number[][];
    labels: number[];
    n_communities: number;
  } | null;

  interdisciplinary_analysis?: InterdisciplinaryAnalysis;

  paper_network?: {
    nodes: {
      id: string | number;
      title: string;
      year: number | null;
      citations: number;
      community: number;
      subcommunity: number;
      author: string;
      abstract: string;
      journal?: string;
      doi?: string;
      x?: number;
      y?: number;
    }[];
    edges: {
      source: string | number;
      target: string | number;
      weight: number;
    }[];
  };

  network_gexf_url?: string | null;
  network_html_url?: string | null;
  csv_url?: string | null;
  excel_url?: string | null;
  job_directory?: string | null; // Added for LLM labeling folder passing
  bc_network?: {
    nodes: Array<any>;
    edges: Array<{ source: number; target: number; weight: number }>;
  };
  cc_network?: {
    nodes: Array<any>;
    edges: Array<{ source: string; target: string; weight: number }>;
  };

  directed_communities?: any[];
  directed_wordcloud_top_terms?: any[];
  directed_citation_confusion_matrix?: CitationConfusionMatrix;
  directed_community_citation_metrics?: CommunityCitationMetric[];
}

// ---------- upload job API types ----------

export interface UploadJobStart {
  job_id: string;
}

export interface UploadJobStatus {
  job_id: string;
  progress: number; // 0..1
  stage: string;
  done: boolean;
  error?: string | null;
  result?: CsvAnalysisResult | null;
  filename?: string;
}

// ---------- REST wrappers (existing endpoints) ----------

export async function fetchDomains(): Promise<string[]> {
  const data = await apiGet<{ domains: string[] }>("/domains");
  return data.domains;
}

export async function analyzeDomain(
  domain: string
): Promise<{ message: string; stats: Stats }> {
  return apiPost<{ message: string; stats: Stats }>(`/analyze/${domain}`);
}

export async function fetchCommunities(): Promise<Community[]> {
  const data = await apiGet<{ communities: Community[] }>("/communities");
  return data.communities;
}

export async function searchPapers(
  query: string,
  topK: number
): Promise<SearchResult[]> {
  const data = await apiPost<{ results: SearchResult[] }>("/search", {
    query,
    top_k: topK,
  });
  return data.results;
}

export async function assignOutlier(
  jobId: string,
  paperId: number,
  communityId: number
): Promise<{ message: string }> {
  return apiPost<{ message: string }>("/assign-outlier", {
    job_id: jobId,
    paper_id: paperId,
    community_id: communityId,
  });
}

// ---------- CSV upload job with real progress ----------

async function startUploadCsvJob(
  file: File,
  startYear?: number,
  endYear?: number,
  windowSize: number = 2
): Promise<UploadJobStart> {
  const formData = new FormData();
  formData.append("file", file);
  if (startYear !== undefined) formData.append("start_year", startYear.toString());
  if (endYear !== undefined) formData.append("end_year", endYear.toString());
  formData.append("window_size", windowSize.toString());

  const res = await fetch(`${API_BASE}/upload-csv/start`, {
    method: "POST",
    headers: withAuthHeaders(),
    body: formData,
  });

  return handleResponse<UploadJobStart>(res);
}

async function fetchUploadCsvJobStatus(
  jobId: string
): Promise<UploadJobStatus> {
  const res = await fetch(`${API_BASE}/upload-csv/progress/${jobId}`, {
    headers: withAuthHeaders(),
  });
  return handleResponse<UploadJobStatus>(res);
}

/**
 * Upload CSV and wait until analysis is done.
 * onProgress(stage, progress 0..1) is called every poll.
 */
export async function uploadAndAnalyzeCsv(
  file: File,
  onProgress?: (stage: string, progress: number) => void,
  startYear?: number,
  endYear?: number,
  windowSize: number = 2
): Promise<CsvAnalysisResult & { job_id: string }> {
  const { job_id } = await startUploadCsvJob(file, startYear, endYear, windowSize);

  return new Promise<CsvAnalysisResult & { job_id: string }>((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await fetchUploadCsvJobStatus(job_id);
        if (onProgress) {
          onProgress(status.stage, status.progress);
        }

        if (status.done) {
          if (status.error) {
            reject(new Error(status.error));
          } else if (status.result) {
            resolve({ ...status.result, job_id, filename: status.filename });
          } else {
            reject(new Error("Job finished but no result was returned."));
          }
          return;
        }

        // not done yet -> poll again
        setTimeout(poll, 1000);
      } catch (err: any) {
        reject(err);
      }
    };

    poll();
  });
}

export interface LlmLabelResponse {
  community_labels: {
    id: number;
    label: string;
  }[];
}

export const generateTopicLabels = async (
  jobId: string,
  modelType: "gemini" | "local" = "gemini",
  apiKey?: string,
  localModelName: string = "Qwen/QwQ-32B-Preview",
  use8bit: boolean = true,
  jobDirectory?: string,
  topPapersPerWindow: number = 2,
  windowSize: number = 2,
  periodStart?: number,
  periodEnd?: number,
  maxPapersForLlm: number = 10,
  topNCommunities: number = 10
): Promise<LlmLabelResponse> => {
  console.log(`DEBUG: Calling /analyze/llm-labels/${jobId} with model_type=${modelType}, top_n=${topNCommunities}`);

  const requestBody: any = {
    model_type: modelType,
    top_n: topNCommunities,
    job_directory: jobDirectory,
    top_papers_per_window: topPapersPerWindow,
    window_size: windowSize,
    period_start: periodStart,
    period_end: periodEnd,
    max_papers_for_llm: maxPapersForLlm
  };

  if (modelType === "gemini") {
    if (!apiKey) {
      throw new Error("API key is required for Gemini model");
    }
    requestBody.api_key = apiKey;
  } else if (modelType === "local") {
    requestBody.local_model_name = localModelName;
    requestBody.use_8bit = use8bit;
  }

  const res = await apiPost<LlmLabelResponse>(`/analyze/llm-labels/${jobId}`, requestBody);
  console.log("DEBUG: API Response:", res);
  return res;
};

export const cleanInterdisciplinaryData = async (
  jobId: string,
  modelType: "gemini" | "local" = "gemini",
  apiKey?: string,
  localModelName: string = "Qwen/QwQ-32B-Preview",
  use8bit: boolean = true,
  jobDirectory?: string
): Promise<{ status: string; interdisciplinary_analysis: InterdisciplinaryAnalysis }> => {
  const requestBody: any = {
    model_type: modelType,
    job_directory: jobDirectory,
    top_n: 50 // Process top 50 entities
  };

  if (modelType === "gemini") {
    if (!apiKey) {
      throw new Error("API key is required for Gemini model");
    }
    requestBody.api_key = apiKey;
  } else if (modelType === "local") {
    requestBody.local_model_name = localModelName;
    requestBody.use_8bit = use8bit;
  }

  const res = await apiPost<{ status: string; interdisciplinary_analysis: InterdisciplinaryAnalysis }>(
    `/analyze/clean-interdisciplinary-data/${jobId}`,
    requestBody
  );
  return res;
};


export async function enhanceCitations(jobId: string, apiKey?: string, instToken?: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`/enhance-citations/${jobId}`, { api_key: apiKey, inst_token: instToken });
}

export async function getEnhanceStatus(jobId: string): Promise<{ status: string; file_exists: boolean }> {
  return apiGet<{ status: string; file_exists: boolean }>(`/enhance-citations/${jobId}/status`);
}

export async function getInterdisciplinaryAnalysis(jobId: string): Promise<InterdisciplinaryAnalysis> {
  return apiGet<InterdisciplinaryAnalysis>(`/analyze/interdisciplinary/${jobId}`);
}

export async function loadInnovationUsecase(): Promise<CsvAnalysisResult> {
  return apiPost<CsvAnalysisResult>("/usecase/innovation");
}

export async function loadEcosystemUsecase(): Promise<CsvAnalysisResult> {
  return apiPost<CsvAnalysisResult>("/usecase/ecosystem");
}

export async function loadMergersAcquisitionUsecase(): Promise<CsvAnalysisResult> {
  return apiPost<CsvAnalysisResult>("/usecase/mergers_acquisition");
}

export async function loadCOOUsecase(): Promise<CsvAnalysisResult> {
  return apiPost<CsvAnalysisResult>("/usecase/coo");
}

export interface CitationMatrixResponse {
  ids: string[];
  matrix: number[][];
  labels?: string[];
  rankings?: {
    by_size: { id: string; label: string; count: number }[];
    by_citation: { id: string; label: string; count: number }[];
  };
  max_val: number;
}

export async function fetchCitationMatrix(usecase: string, top_n: number): Promise<CitationMatrixResponse> {
  return apiPost<CitationMatrixResponse>("/citation_matrix", { usecase, top_n });
}

export async function fetchReferenceReport(filename: string): Promise<{ content: string }> {
  return apiGet<{ content: string }>(`/reference-report/${filename}`);
}
