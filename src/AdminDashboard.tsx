
import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Log {
    id: number;
    user_id: number;
    action: string;
    details: string;
    timestamp: string;
}

interface Stats {
    total_users: number;
    total_uploads: number;
    successful_uploads: number;
    failed_uploads: number;
    unique_datasets: number;
    requests_per_day: { date: string; count: number }[];
    timestamp: string;
}

interface UserStat {
    user_id: number;
    email: string;
    name: string;
    total_uploads: number;
    successful: number;
    failed: number;
    filenames: string[];
    ips: string[];
}

interface Dataset {
    hash: string;
    filename: string;
    size: number;
    first_seen: string;
    total_attempts: number;
    successful_attempts: number;
    failed_attempts: number;
}

interface DiskStat {
    hash: string;
    size: number;
    paths: string[];
    count: number;
}

const AdminDashboard: React.FC<{ user: any }> = ({ user }) => {
    const [logs, setLogs] = useState<Log[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [userStats, setUserStats] = useState<UserStat[]>([]);
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [diskStats, setDiskStats] = useState<DiskStat[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const apiBase = import.meta.env.VITE_API_BASE || "/api";

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const logsRes = await axios.get(`${apiBase}/admin/activity-logs`, { params: { user_id: user.id } });
                setLogs(logsRes.data);

                const statsRes = await axios.get(`${apiBase}/analytics/stats`);
                setStats(statsRes.data);

                const usersRes = await axios.get(`${apiBase}/analytics/users`);
                setUserStats(usersRes.data);

                const datasetsRes = await axios.get(`${apiBase}/analytics/datasets`);
                setDatasets(datasetsRes.data);

                const diskRes = await axios.get(`${apiBase}/admin/disk-stats`, { params: { user_id: user.id } });
                setDiskStats(diskRes.data);
            } catch (err) {
                console.error("Error fetching admin data:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // Aggregate IPs
    const ipStats = React.useMemo(() => {
        const map = new Map<string, { users: string[], total_uploads: number }>();
        userStats.forEach(u => {
            if (u.ips && u.ips.length > 0) {
                u.ips.forEach(ip => {
                    if (!map.has(ip)) {
                        map.set(ip, { users: [], total_uploads: 0 });
                    }
                    const entry = map.get(ip)!;
                    entry.users.push(u.email);
                });
            }
        });
        return Array.from(map.entries()).map(([ip, data]) => ({ ip, ...data }));
    }, [userStats]);

    if (isLoading) {
        return <div style={{ padding: "2rem", textAlign: "center" }}>Loading dashboard data...</div>;
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", width: "100%" }}>

            {/* Overview Stats Cards */}
            {stats && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                    <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
                        <h3 style={{ margin: "0 0 0.5rem 0", color: "#666" }}>Total Users</h3>
                        <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#007bff" }}>{stats.total_users}</div>
                    </div>
                    <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
                        <h3 style={{ margin: "0 0 0.5rem 0", color: "#666" }}>Total Requests</h3>
                        <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#28a745" }}>{stats.total_uploads}</div>
                        <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.5rem" }}>
                            {stats.successful_uploads} success / {stats.failed_uploads} failed
                        </div>
                    </div>
                    <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
                        <h3 style={{ margin: "0 0 0.5rem 0", color: "#666" }}>Unique Datasets (DB)</h3>
                        <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#6f42c1" }}>{stats.unique_datasets}</div>
                    </div>
                    <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
                        <h3 style={{ margin: "0 0 0.5rem 0", color: "#666" }}>Total Stored Datasets</h3>
                        <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#dc3545" }}>{diskStats.length}</div>
                    </div>
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>
                {/* Daily Requests */}
                <div className="card">
                    <div className="card-header">
                        <h2>Requests Per Day</h2>
                    </div>
                    <div className="card-body">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats && stats.requests_per_day && stats.requests_per_day.length > 0 ? (
                                    stats.requests_per_day.map(d => (
                                        <tr key={d.date}>
                                            <td>{d.date}</td>
                                            <td style={{ fontWeight: "bold" }}>{d.count}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={2} style={{ color: "#999", textAlign: "center" }}>No request data</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* User Statistics */}
                <div className="card">
                    <div className="card-header">
                        <h2>User Statistics</h2>
                    </div>
                    <div className="card-body">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Uploads</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userStats.map(user => (
                                    <tr key={user.user_id}>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{user.name}</div>
                                            <div style={{ fontSize: "0.85rem", color: "#666" }}>{user.email}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: "bold" }}>{user.total_uploads}</div>
                                            <div style={{ fontSize: "0.8rem", color: "#666" }}>
                                                {user.successful} ✅ / {user.failed} ❌
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: "0.85rem" }}>
                                                <strong>IPs:</strong> {user.ips?.join(", ") || "None"}
                                                <br />
                                                <strong>Files:</strong> {user.filenames?.join(", ") || "None"}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* IP Analysis */}
                <div className="card">
                    <div className="card-header">
                        <h2>User Distribution by IP</h2>
                    </div>
                    <div className="card-body">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>IP Address</th>
                                    <th>Users</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ipStats.length > 0 ? ipStats.map(stat => (
                                    <tr key={stat.ip}>
                                        <td style={{ fontWeight: "bold", fontFamily: "monospace" }}>{stat.ip}</td>
                                        <td>
                                            {stat.users.map(u => (
                                                <div key={u} style={{ fontSize: "0.9rem" }}>{u}</div>
                                            ))}
                                            <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.2rem" }}>
                                                Total: {stat.users.length} user(s)
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={2} style={{ color: "#999", textAlign: "center" }}>No IP data collected yet</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Disk Storage Analysis */}
            <div className="card">
                <div className="card-header">
                    <h2>Disk Storage Analysis (Historical)</h2>
                </div>
                <div className="card-body">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Hash</th>
                                <th>Size</th>
                                <th>Occurrences</th>
                                <th>Sample Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            {diskStats.map(ds => (
                                <tr key={ds.hash}>
                                    <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{ds.hash.substring(0, 10)}...</td>
                                    <td>{(ds.size / (1024 * 1024)).toFixed(2)} MB</td>
                                    <td>{ds.count}</td>
                                    <td style={{ fontSize: "0.75rem", color: "#666", wordBreak: "break-all" }}>
                                        {ds.paths[0].split('/').slice(-2).join('/')}
                                    </td>
                                </tr>
                            ))}
                            {diskStats.length === 0 && (
                                <tr><td colSpan={4} style={{ textAlign: "center", color: "#999" }}>No dataset files found on disk</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Unique Datasets (DB) */}
            <div className="card">
                <div className="card-header">
                    <h2>Unique Datasets (Logged)</h2>
                </div>
                <div className="card-body">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Filename</th>
                                <th>Hash (Start)</th>
                                <th>Size</th>
                                <th>First Seen</th>
                                <th>Attempts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {datasets.map(ds => (
                                <tr key={ds.hash}>
                                    <td style={{ fontWeight: 500 }}>{ds.filename}</td>
                                    <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{ds.hash.substring(0, 10)}...</td>
                                    <td>{(ds.size / 1024).toFixed(1)} KB</td>
                                    <td>{new Date(ds.first_seen).toLocaleString()}</td>
                                    <td>
                                        <span style={{ fontWeight: "bold" }}>{ds.total_attempts}</span>
                                        <span style={{ fontSize: "0.85rem", marginLeft: "0.5rem" }}>
                                            ({ds.successful_attempts} ✅ / {ds.failed_attempts} ❌)
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {datasets.length === 0 && (
                                <tr><td colSpan={5} style={{ textAlign: "center", color: "#999" }}>No datasets found in logs</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Activity Logs */}
            <div className="card">
                <div className="card-header">
                    <h2>Recent Activity Log</h2>
                </div>
                <div className="card-body">
                    <table className="table small">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>User ID</th>
                                <th>Action</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id}>
                                    <td style={{ whiteSpace: "nowrap" }}>{new Date(log.timestamp).toLocaleString()}</td>
                                    <td>{log.user_id}</td>
                                    <td>{log.action}</td>
                                    <td style={{ maxWidth: "400px", wordBreak: "break-word" }}>
                                        {(() => {
                                            try {
                                                const d = JSON.parse(log.details);
                                                return (
                                                    <div style={{ fontSize: "0.85rem" }}>
                                                        {d.filename && <div><strong>File:</strong> {d.filename}</div>}
                                                        {d.settings && <div><strong>Settings:</strong> {JSON.stringify(d.settings)}</div>}
                                                        {d.error && <div style={{ color: "red" }}><strong>Error:</strong> {d.error}</div>}
                                                        {!d.filename && JSON.stringify(d)}
                                                    </div>
                                                );
                                            } catch {
                                                return log.details;
                                            }
                                        })()}
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

export default AdminDashboard;
