import type { ExecutionPlan } from '../helpers/planEditorTypes';

interface PlanFlowTabProps {
    plan: ExecutionPlan;
    hoveredNode: string | null;
    setHoveredNode: (v: string | null) => void;
}

const getTypeBadgeStyle = (type: string) => {
    switch (type.toLowerCase()) {
        case 'class':
            return { background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.3)' };
        case 'module':
            return { background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' };
        case 'service':
            return { background: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', border: '1px solid rgba(20, 184, 166, 0.3)' };
        case 'interface':
            return { background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' };
        case 'external':
            return { background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255, 255, 255, 0.1)' };
        default:
            return { background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8', border: '1px solid rgba(129, 140, 248, 0.3)' };
    }
};

export function PlanFlowTab({ plan, hoveredNode, setHoveredNode }: PlanFlowTabProps) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)',
            padding: '30px',
            backdropFilter: 'blur(8px)',
            gap: '32px',
            width: '100%'
        }}>
            {plan.steps.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', textAlign: 'center' }}>
                    <div style={{ marginBottom: 8 }}>Add steps to display the flowchart</div>
                    <div style={{ fontSize: 11 }}>Go to the Roadmap Steps tab to add steps, then return here to see the visual flow.</div>
                </div>
            ) : (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'center' }}>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h4 style={{ margin: '0 0 16px 0', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="codicon codicon-git-compare" style={{ color: '#818cf8' }} /> Roadmap Execution Flow
                        </h4>
                        <svg width="100%" height={Math.max(300, plan.steps.length * 90)} style={{ maxWidth: '600px' }}>
                            <defs>
                                <linearGradient id="nodeGradCompleted" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="rgba(52, 211, 153, 0.15)" />
                                    <stop offset="100%" stopColor="rgba(5, 150, 105, 0.02)" />
                                </linearGradient>
                                <linearGradient id="nodeGradPending" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="rgba(255, 255, 255, 0.03)" />
                                    <stop offset="100%" stopColor="rgba(255, 255, 255, 0.005)" />
                                </linearGradient>
                                <linearGradient id="strokeGradCompleted" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#34d399" />
                                    <stop offset="100%" stopColor="#059669" />
                                </linearGradient>
                                <linearGradient id="strokeGradPending" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="rgba(255, 255, 255, 0.15)" />
                                    <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
                                </linearGradient>
                                <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#818cf8" />
                                    <stop offset="100%" stopColor="#c084fc" />
                                </linearGradient>
                                <filter id="glow-active" x="-25%" y="-25%" width="150%" height="150%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#818cf8" floodOpacity="0.4" />
                                </filter>
                                <filter id="glow-completed" x="-25%" y="-25%" width="150%" height="150%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#34d399" floodOpacity="0.3" />
                                </filter>
                                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#818cf8" />
                                </marker>
                                <marker id="arrow-completed" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#34d399" />
                                </marker>
                            </defs>
                            <style>{`
                                @keyframes dash {
                                    to {
                                        stroke-dashoffset: -40;
                                    }
                                }
                            `}</style>
                            {/* eslint-disable-next-line complexity */}
                            {plan.steps.map((step, idx) => {
                                if (!step.action || !step.target) {
                                    console.warn(`[PlanEditor:flow] Step ${idx} missing action or target:`, { action: step.action, target: step.target, order: step.order });
                                }
                                const y = 30 + idx * 90;
                                const rectWidth = 240;
                                const rectHeight = 50;
                                const x = (600 - rectWidth) / 2;

                                return (
                                    <g key={idx} className="node">
                                        <rect
                                            x={x} y={y} width={rectWidth} height={rectHeight} rx="8" ry="8"
                                            fill={step.completed ? 'url(#nodeGradCompleted)' : 'url(#nodeGradPending)'}
                                            stroke={step.completed ? 'url(#strokeGradCompleted)' : 'url(#strokeGradPending)'}
                                            strokeWidth="1.5"
                                            filter={step.completed ? 'url(#glow-completed)' : 'none'}
                                        />
                                        <circle cx={x + 20} cy={y + 25} r="10" fill={step.completed ? 'rgba(52, 211, 153, 0.15)' : 'rgba(129, 140, 248, 0.15)'} />
                                        <text x={x + 20} y={y + 28} textAnchor="middle" fill={step.completed ? '#34d399' : '#818cf8'} fontSize="10" fontWeight="bold">{step.order}</text>

                                        <text x={x + 40} y={y + 22} fill="white" fontWeight="600" fontSize="11">{(step.action || '').toUpperCase() || '?'}</text>
                                        <text x={x + 40} y={y + 38} fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="JetBrains Mono, monospace">{(step.target || '').length > 25 ? (step.target || '').slice(0, 25) + '...' : (step.target || '?')}</text>

                                        {idx < plan.steps.length - 1 && (
                                            <path
                                                d={`M 300,${y + rectHeight} L 300,${y + 90}`}
                                                stroke={step.completed ? '#34d399' : '#818cf8'}
                                                strokeWidth="1.5"
                                                markerEnd={step.completed ? 'url(#arrow-completed)' : 'url(#arrow)'}
                                                strokeDasharray={step.completed ? 'none' : '4, 4'}
                                                style={{
                                                    animation: step.completed ? 'none' : 'dash 2s linear infinite',
                                                    opacity: step.completed ? 0.8 : 0.6
                                                }}
                                            />
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>

                    {plan.classDependencies && plan.classDependencies.length > 0 && (() => {
                        const deps = plan.classDependencies || [];
                        const declaredNames = new Set(deps.map(d => d.name));
                        const allNodes = [...deps];

                        const allDependsOn = new Set<string>();
                        deps.forEach(d => {
                            if (d.dependsOn) {
                                d.dependsOn.forEach(depName => {
                                    if (depName && !declaredNames.has(depName)) {
                                        allDependsOn.add(depName);
                                    }
                                });
                            }
                        });

                        allDependsOn.forEach(extName => {
                            allNodes.push({
                                name: extName,
                                type: 'external',
                                dependsOn: [],
                                description: 'External dependency used by the plan classes.'
                            });
                        });

                        const N = allNodes.length;
                        const centerX = 300;
                        const centerY = 190;
                        const radius = 120;

                        const nodeCoords: Record<string, { x: number; y: number }> = {};
                        allNodes.forEach((node, idx) => {
                            const angle = (idx * 2 * Math.PI) / (N || 1) - Math.PI / 2;
                            nodeCoords[node.name] = {
                                x: centerX + radius * Math.cos(angle),
                                y: centerY + radius * Math.sin(angle)
                            };
                        });

                        const getRelationStatus = (nodeName: string) => {
                            if (!hoveredNode) return 'normal';
                            if (hoveredNode === nodeName) return 'hovered';

                            const hoveredNodeData = allNodes.find(n => n.name === hoveredNode);
                            if (hoveredNodeData?.dependsOn?.includes(nodeName)) {
                                return 'provider';
                            }

                            const thisNodeData = allNodes.find(n => n.name === nodeName);
                            if (thisNodeData?.dependsOn?.includes(hoveredNode)) {
                                return 'consumer';
                            }

                            return 'dimmed';
                        };

                        return (
                            <div style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                borderTop: '1px solid rgba(255,255,255,0.06)',
                                paddingTop: '24px'
                            }}>
                                <h4 style={{ margin: '0 0 16px 0', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="codicon codicon-git-branch" style={{ color: '#a855f7' }} /> Class & Module Dependencies
                                </h4>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: hoveredNode ? 'row' : 'column',
                                    gap: '24px',
                                    width: '100%',
                                    justifyContent: hoveredNode ? 'flex-start' : 'center',
                                    alignItems: hoveredNode ? 'stretch' : 'center',
                                }}>
                                    {hoveredNode ? (
                                        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '16px', minWidth: '220px', maxWidth: '260px', alignSelf: 'flex-start' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span className="codicon codicon-info" style={{ color: '#a855f7' }} />
                                                {hoveredNode}
                                            </div>
                                            {(() => {
                                                const node = allNodes.find(n => n.name === hoveredNode);
                                                if (!node) return <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>No details available</div>;
                                                const depOf = allNodes.filter(n => n.dependsOn?.includes(hoveredNode)).map(n => n.name);
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        <div><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase' }}>Type</span><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}><span style={getTypeBadgeStyle(node.type)}>{node.type}</span></div></div>
                                                        <div><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase' }}>Description</span><p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: '2px 0 0 0', lineHeight: 1.4 }}>{node.description}</p></div>
                                                        {node.dependsOn.length > 0 && <div><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase' }}>Depends On</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>{node.dependsOn.map(d => <span key={d} style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{d}</span>)}</div></div>}
                                                        {depOf.length > 0 && <div><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase' }}>Depended By</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>{depOf.map(d => <span key={d} style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{d}</span>)}</div></div>}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    ) : null}
                                    <svg width={hoveredNode ? 400 : 600} height={hoveredNode ? 400 : 380} style={{ maxWidth: '100%', flexShrink: 0 }}>
                                        <defs>
                                            <marker id="depArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                                                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.2)" />
                                            </marker>
                                            <marker id="depArrowActive" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                                                <path d="M 0 0 L 10 5 L 0 10 z" fill="#a855f7" />
                                            </marker>
                                            <filter id="node-glow">
                                                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#a855f7" floodOpacity="0.5" />
                                            </filter>
                                        </defs>
                                        {allNodes.map((node) => {
                                            const src = nodeCoords[node.name];
                                            if (!src) return null;
                                            return (node.dependsOn || []).map((depName) => {
                                                const tgt = nodeCoords[depName];
                                                if (!tgt) return null;
                                                const isHoveredSrc = hoveredNode === node.name;
                                                const isHoveredTgt = hoveredNode === depName;
                                                const isActivePath = hoveredNode !== null && (isHoveredSrc || isHoveredTgt);
                                                const isDimmedPath = hoveredNode !== null && !isHoveredSrc && !isHoveredTgt;
                                                return (
                                                    <line
                                                        key={`${node.name}-${depName}`}
                                                        x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                                                        stroke={isActivePath ? '#a855f7' : isDimmedPath ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)'}
                                                        strokeWidth={isActivePath ? 2 : 1}
                                                        markerEnd={isActivePath ? 'url(#depArrowActive)' : 'url(#depArrow)'}
                                                    />
                                                );
                                            });
                                        })}
                                        {allNodes.map((node) => {
                                            const coord = nodeCoords[node.name];
                                            if (!coord) return null;
                                            const status = getRelationStatus(node.name);
                                            const opacity = status === 'dimmed' ? 0.2 : 1;
                                            return (
                                                <g key={node.name} onMouseEnter={() => setHoveredNode(node.name)} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'pointer' }}>
                                                    <circle cx={coord.x} cy={coord.y} r="22" fill={status === 'hovered' ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.08)'} stroke={status === 'hovered' ? '#a855f7' : status === 'provider' ? '#34d399' : status === 'consumer' ? '#fbbf24' : 'rgba(255,255,255,0.1)'} strokeWidth={status === 'hovered' ? 2 : 1} filter={status === 'hovered' ? 'url(#node-glow)' : 'none'} />
                                                    <text x={coord.x} y={coord.y + 1} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="9" fontWeight="500" opacity={opacity}>{node.name.length > 12 ? node.name.slice(0, 11) + '…' : node.name}</text>
                                                </g>
                                            );
                                        })}
                                    </svg>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
