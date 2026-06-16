import React from 'react';

interface ScopusInstructionsProps {
    onBack: () => void;
}

const ScopusInstructions: React.FC<ScopusInstructionsProps> = ({ onBack }) => {
    return (
        <div className="app">
            <div className="app-shell">
                <header className="app-header">
                    <div>
                        <h1 className="app-title">How to export from Scopus</h1>
                        <p className="app-subtitle">Step-by-step guide for S3 analysis data export</p>
                    </div>
                    <button className="secondary-button" onClick={onBack}>
                        Back to App
                    </button>
                </header>

                <section className="card">
                    <div className="card-body">
                        <p>Please follow these steps to export your data correctly for S3 analysis:</p>
                        <ol style={{ marginLeft: '1.5rem', marginBottom: '1rem', lineHeight: '1.6' }}>
                            <li>Run your query in Scopus.</li>
                            <li>Select <strong>"All"</strong> documents (or the specific range you want).</li>
                            <li>Click <strong>"Export"</strong> and select <strong>"CSV"</strong> format.</li>
                            <li><strong>Crucial:</strong> Select <strong>all</strong> column categories:
                                <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                                    <li>Citation information</li>
                                    <li>Bibliographical information</li>
                                    <li>Abstract & keywords</li>
                                    <li>Funding details</li>
                                    <li>Other information</li>
                                </ul>
                            </li>
                        </ol>
                        <div style={{ border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden', marginTop: '1rem' }}>
                            <img
                                src={`${import.meta.env.BASE_URL}Scopus.png`}
                                alt="Scopus Export Instructions"
                                style={{ width: '100%', display: 'block' }}
                            />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ScopusInstructions;
