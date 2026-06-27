import type { ExecutionPlan } from '../helpers/planEditorTypes';

interface PlanOverviewTabProps {
    plan: ExecutionPlan;
    isEditingExpectedOutcome: boolean;
    editingExpectedOutcomeText: string;
    setEditingExpectedOutcomeText: (v: string) => void;
    setIsEditingExpectedOutcome: (v: boolean) => void;
    handleSaveExpectedOutcome: () => void;
    showAddRead: boolean;
    setShowAddRead: (v: boolean) => void;
    newReadText: string;
    setNewReadText: (v: string) => void;
    handleAddReadItem: () => void;
    editingReadIndex: number | null;
    editingReadText: string;
    setEditingReadText: (v: string) => void;
    setEditingReadIndex: (v: number | null) => void;
    handleSaveReadItem: (i: number) => void;
    handleDeleteReadItem: (i: number) => void;
    showAddModify: boolean;
    setShowAddModify: (v: boolean) => void;
    newModifyText: string;
    setNewModifyText: (v: string) => void;
    handleAddModifyItem: () => void;
    editingModifyIndex: number | null;
    editingModifyText: string;
    setEditingModifyText: (v: string) => void;
    setEditingModifyIndex: (v: number | null) => void;
    handleSaveModifyItem: (i: number) => void;
    handleDeleteModifyItem: (i: number) => void;
    showAddCreate: boolean;
    setShowAddCreate: (v: boolean) => void;
    newCreateText: string;
    setNewCreateText: (v: string) => void;
    handleAddCreateItem: () => void;
    editingCreateIndex: number | null;
    editingCreateText: string;
    setEditingCreateText: (v: string) => void;
    setEditingCreateIndex: (v: number | null) => void;
    handleSaveCreateItem: (i: number) => void;
    handleDeleteCreateItem: (i: number) => void;
    showAddCrit: boolean;
    setShowAddCrit: (v: boolean) => void;
    newCritText: string;
    setNewCritText: (v: string) => void;
    handleAddCritItem: () => void;
    editingCritIndex: number | null;
    editingCritText: string;
    setEditingCritText: (v: string) => void;
    setEditingCritIndex: (v: number | null) => void;
    handleSaveCritItem: (i: number) => void;
    handleDeleteCritItem: (i: number) => void;
}

// eslint-disable-next-line complexity
export function PlanOverviewTab({
    plan,
    isEditingExpectedOutcome,
    editingExpectedOutcomeText,
    setEditingExpectedOutcomeText,
    setIsEditingExpectedOutcome,
    handleSaveExpectedOutcome,
    showAddRead,
    setShowAddRead,
    newReadText,
    setNewReadText,
    handleAddReadItem,
    editingReadIndex,
    editingReadText,
    setEditingReadText,
    setEditingReadIndex,
    handleSaveReadItem,
    handleDeleteReadItem,
    showAddModify,
    setShowAddModify,
    newModifyText,
    setNewModifyText,
    handleAddModifyItem,
    editingModifyIndex,
    editingModifyText,
    setEditingModifyText,
    setEditingModifyIndex,
    handleSaveModifyItem,
    handleDeleteModifyItem,
    showAddCreate,
    setShowAddCreate,
    newCreateText,
    setNewCreateText,
    handleAddCreateItem,
    editingCreateIndex,
    editingCreateText,
    setEditingCreateText,
    setEditingCreateIndex,
    handleSaveCreateItem,
    handleDeleteCreateItem,
    showAddCrit,
    setShowAddCrit,
    newCritText,
    setNewCritText,
    handleAddCritItem,
    editingCritIndex,
    editingCritText,
    setEditingCritText,
    setEditingCritIndex,
    handleSaveCritItem,
    handleDeleteCritItem,
}: PlanOverviewTabProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '850px', margin: '0 auto' }}>
            <div style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '20px',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="codicon codicon-target" style={{ color: '#818cf8' }} /> Expected Outcome
                    </h3>
                    {!isEditingExpectedOutcome ? (
                        <button
                            onClick={() => {
                                setEditingExpectedOutcomeText(plan.expectedOutcome);
                                setIsEditingExpectedOutcome(true);
                            }}
                            style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: 'pointer' }}
                        >
                            <span className="codicon codicon-edit" />
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => setIsEditingExpectedOutcome(false)} style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', fontSize: '11px' }}>Cancel</button>
                            <button onClick={handleSaveExpectedOutcome} style={{ background: '#818cf8', border: 'none', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Save</button>
                        </div>
                    )}
                </div>
                {isEditingExpectedOutcome ? (
                    <textarea
                        value={editingExpectedOutcomeText}
                        onChange={e => setEditingExpectedOutcomeText(e.target.value)}
                        style={{
                            width: '100%',
                            minHeight: '60px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            padding: '8px',
                            borderRadius: '6px',
                            outline: 'none',
                            fontSize: '12.5px',
                            resize: 'vertical'
                        }}
                    />
                ) : (
                    <p style={{ margin: 0, fontSize: '13px', color: plan.expectedOutcome ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.3)', fontStyle: plan.expectedOutcome ? 'normal' : 'italic', lineHeight: 1.55 }}>{plan.expectedOutcome || 'No expected outcome defined yet. Use "Modify Plan with AI" below to generate one.'}</p>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '12px',
                    padding: '20px',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="codicon codicon-book" style={{ color: '#38bdf8' }} /> Files to Read
                        </h3>
                        <button
                            onClick={() => setShowAddRead(!showAddRead)}
                            style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer' }}
                        >
                            <span className="codicon codicon-add" />
                        </button>
                    </div>

                    {showAddRead && (
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                            <input
                                type="text"
                                placeholder="src/filename.ts"
                                value={newReadText}
                                onChange={e => setNewReadText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddReadItem()}
                                style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
                            />
                            <button onClick={handleAddReadItem} style={{ padding: '2px 8px', background: '#38bdf8', border: 'none', borderRadius: '4px', color: '#0d1117', fontSize: '11px', fontWeight: 600 }}>Add</button>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(plan.filesRead || []).map((file, i) => {
                            const isEditingItem = editingReadIndex === i;
                            return (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    padding: '6px 12px',
                                    borderRadius: '6px'
                                }}>
                                    {isEditingItem ? (
                                        <input
                                            type="text"
                                            value={editingReadText}
                                            onChange={e => setEditingReadText(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSaveReadItem(i)}
                                            onBlur={() => handleSaveReadItem(i)}
                                            autoFocus
                                            style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}
                                        />
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                                            <span className="codicon codicon-file" style={{ color: '#38bdf8' }} />
                                            <span>{file}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                            onClick={() => {
                                                setEditingReadText(file);
                                                setEditingReadIndex(i);
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                                        >
                                            <span className="codicon codicon-edit" style={{ fontSize: '10px' }} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteReadItem(i)}
                                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                                        >
                                            <span className="codicon codicon-trash" style={{ fontSize: '10px' }} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {(!plan.filesRead || plan.filesRead.length === 0) && (
                            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.35)', fontStyle: 'italic' }}>No files listed for reading - add files above or use AI to generate the plan</div>
                        )}
                    </div>
                </div>

                <div style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '12px',
                    padding: '20px',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="codicon codicon-edit" style={{ color: '#fb923c' }} /> Files to Modify
                        </h3>
                        <button
                            onClick={() => setShowAddModify(!showAddModify)}
                            style={{ background: 'none', border: 'none', color: '#fb923c', cursor: 'pointer' }}
                        >
                            <span className="codicon codicon-add" />
                        </button>
                    </div>

                    {showAddModify && (
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                            <input
                                type="text"
                                placeholder="src/filename.ts"
                                value={newModifyText}
                                onChange={e => setNewModifyText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddModifyItem()}
                                style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
                            />
                            <button onClick={handleAddModifyItem} style={{ padding: '2px 8px', background: '#fb923c', border: 'none', borderRadius: '4px', color: '#0d1117', fontSize: '11px', fontWeight: 600 }}>Add</button>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(plan.filesToModify || []).map((file, i) => {
                            const isEditingItem = editingModifyIndex === i;
                            return (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    padding: '6px 12px',
                                    borderRadius: '6px'
                                }}>
                                    {isEditingItem ? (
                                        <input
                                            type="text"
                                            value={editingModifyText}
                                            onChange={e => setEditingModifyText(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSaveModifyItem(i)}
                                            onBlur={() => handleSaveModifyItem(i)}
                                            autoFocus
                                            style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}
                                        />
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                                            <span className="codicon codicon-edit" style={{ color: '#fb923c' }} />
                                            <span>{file}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                            onClick={() => {
                                                setEditingModifyText(file);
                                                setEditingModifyIndex(i);
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                                        >
                                            <span className="codicon codicon-edit" style={{ fontSize: '10px' }} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteModifyItem(i)}
                                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                                        >
                                            <span className="codicon codicon-trash" style={{ fontSize: '10px' }} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {(!plan.filesToModify || plan.filesToModify.length === 0) && (
                            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.35)', fontStyle: 'italic' }}>No files listed for modification - add files above or use AI to generate the plan</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Files to Create */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '20px',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="codicon codicon-new-file" style={{ color: '#4ec9b0' }} /> Files to Create
                    </h3>
                    <button
                        onClick={() => setShowAddCreate(!showAddCreate)}
                        style={{ background: 'none', border: 'none', color: '#4ec9b0', cursor: 'pointer' }}
                    >
                        <span className="codicon codicon-add" />
                    </button>
                </div>

                {showAddCreate && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                        <input
                            type="text"
                            placeholder="src/filename.ts"
                            value={newCreateText}
                            onChange={e => setNewCreateText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddCreateItem()}
                            style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
                        />
                        <button onClick={handleAddCreateItem} style={{ padding: '2px 8px', background: '#4ec9b0', border: 'none', borderRadius: '4px', color: '#0d1117', fontSize: '11px', fontWeight: 600 }}>Add</button>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(plan.filesToCreate || []).map((file, i) => {
                        const isEditingItem = editingCreateIndex === i;
                        return (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                padding: '6px 12px',
                                borderRadius: '6px'
                            }}>
                                {isEditingItem ? (
                                    <input
                                        type="text"
                                        value={editingCreateText}
                                        onChange={e => setEditingCreateText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveCreateItem(i)}
                                        onBlur={() => handleSaveCreateItem(i)}
                                        autoFocus
                                        style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}
                                    />
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                                        <span className="codicon codicon-new-file" style={{ color: '#4ec9b0' }} />
                                        <span>{file}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                        onClick={() => {
                                            setEditingCreateText(file);
                                            setEditingCreateIndex(i);
                                        }}
                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                                    >
                                        <span className="codicon codicon-edit" style={{ fontSize: '10px' }} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteCreateItem(i)}
                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                                    >
                                        <span className="codicon codicon-trash" style={{ fontSize: '10px' }} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {(!plan.filesToCreate || plan.filesToCreate.length === 0) && (
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.35)', fontStyle: 'italic' }}>No files listed for creation - add files above or use AI to generate the plan</div>
                    )}
                </div>
            </div>

            {/* Verification & Testing Criteria */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '20px',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="codicon codicon-beaker" style={{ color: '#c084fc' }} /> Verification & Testing Criteria
                    </h3>
                    <button
                        onClick={() => setShowAddCrit(!showAddCrit)}
                        style={{ background: 'none', border: 'none', color: '#c084fc', cursor: 'pointer' }}
                    >
                        <span className="codicon codicon-add" />
                    </button>
                </div>

                {showAddCrit && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                        <input
                            type="text"
                            placeholder="Ensure compilation passes..."
                            value={newCritText}
                            onChange={e => setNewCritText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddCritItem()}
                            style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
                        />
                        <button onClick={handleAddCritItem} style={{ padding: '2px 8px', background: '#c084fc', border: 'none', borderRadius: '4px', color: '#0d1117', fontSize: '11px', fontWeight: 600 }}>Add</button>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(plan.verificationCriteria || []).map((crit, i) => {
                        const isEditingItem = editingCritIndex === i;
                        return (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                padding: '8px 14px',
                                borderRadius: '6px'
                            }}>
                                {isEditingItem ? (
                                    <input
                                        type="text"
                                        value={editingCritText}
                                        onChange={e => setEditingCritText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveCritItem(i)}
                                        onBlur={() => handleSaveCritItem(i)}
                                        autoFocus
                                        style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', outline: 'none', fontSize: '12px' }}
                                    />
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                                        <span className="codicon codicon-pass-filled" style={{ color: '#c084fc' }} />
                                        <span>{crit}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                        onClick={() => {
                                            setEditingCritText(crit);
                                            setEditingCritIndex(i);
                                        }}
                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                                    >
                                        <span className="codicon codicon-edit" style={{ fontSize: '10px' }} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteCritItem(i)}
                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                                    >
                                        <span className="codicon codicon-trash" style={{ fontSize: '10px' }} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {(!plan.verificationCriteria || plan.verificationCriteria.length === 0) && (
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.35)', fontStyle: 'italic' }}>No verification criteria specified - add criteria above or use AI to generate the plan</div>
                    )}
                </div>
            </div>
        </div>
    );
}
