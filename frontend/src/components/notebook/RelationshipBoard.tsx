import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  ConnectionMode,
  MarkerType,
  applyNodeChanges,
  useStore,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeProps,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCaseNotes, type RelationshipNode } from '../../contexts/CaseNotesContext'
import { useScenario } from '../../contexts/ScenarioContext'
import { useLanguage } from '../../contexts/LanguageContext'
import './RelationshipBoard.css'

// Common relationship types, ready to pick with one click instead of typing
// a label from scratch every time — each carries its own color so edges
// stay visually distinguishable at a glance.
const EDGE_PRESETS = [
  { ja: '動機',   en: 'Motive',    color: '#a8342f' },
  { ja: 'アリバイ', en: 'Alibi',     color: '#35608c' },
  { ja: '疑惑',   en: 'Suspicion', color: '#9c6b1f' },
  { ja: '友人',   en: 'Friend',    color: '#2f7a3d' },
  { ja: '敵対',   en: 'Hostile',   color: '#7a2420' },
  { ja: '恋愛',   en: 'Romantic',  color: '#b0568a' },
  { ja: '家族',   en: 'Family',    color: '#4a7a6e' },
]

const SWATCHES = ['#a8342f', '#35608c', '#9c6b1f', '#2f7a3d', '#7a2420', '#b0568a', '#4a7a6e', '#3a3020']

interface EdgeEditorState {
  mode: 'create' | 'edit'
  edgeId?: string
  source?: string
  target?: string
  sourceHandle?: string
  targetHandle?: string
  bidirectional: boolean
}

// Custom edge that bows perpendicular to the source→target line by a fixed
// pixel amount, instead of relying on the built-in bezier `curvature` (which
// only offsets along the connection axis — it does nothing when two nodes
// happen to line up vertically or horizontally, so parallel edges between
// the same pair still landed exactly on top of each other).
function FannedEdge({ id, sourceX, sourceY, targetX, targetY, label, style, markerEnd, markerStart, data }: EdgeProps) {
  const edgeData = data as { color: string; offset: number; onBendChange: (id: string, offset: number) => void; onLabelClick: (id: string) => void }
  const zoom = useStore((s) => s.transform[2])
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const offset = dragOffset ?? edgeData.offset
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const perpX = -dy / len
  const perpY = dx / len
  // Shift the endpoints themselves too (not just the midpoint) — otherwise
  // every parallel edge still converges to the exact same point right where
  // it meets the node, and the arrowheads end up bunched together there
  // even though the middle of the lines fan out fine.
  const endOffset = offset * 0.45
  const sx = sourceX + perpX * endOffset
  const sy = sourceY + perpY * endOffset
  const tx = targetX + perpX * endOffset
  const ty = targetY + perpY * endOffset
  const midX = (sx + tx) / 2 + perpX * offset
  const midY = (sy + ty) / 2 + perpY * offset

  // Stop the drawn line a few px short of each node's handle dot. The dots
  // live in the nodes pane, which paints above the edges pane, so a line
  // (and its arrowhead) that runs all the way to the exact handle center
  // renders completely underneath — and therefore invisible behind — the
  // opaque dot. Pulling back along the curve's own tangent leaves the
  // arrowhead sitting just before the dot instead of hidden beneath it.
  // Matches the handle dot's own size (.rel-handle in RelationshipBoard.css)
  // — resizing one without the other reopens the same invisible-arrow bug.
  const GAP = 9
  const pullBack = (fromX: number, fromY: number, towardX: number, towardY: number) => {
    const ddx = towardX - fromX
    const ddy = towardY - fromY
    const dlen = Math.sqrt(ddx * ddx + ddy * ddy) || 1
    return [towardX - (ddx / dlen) * GAP, towardY - (ddy / dlen) * GAP] as const
  }
  const [drawTx, drawTy] = pullBack(midX, midY, tx, ty)
  const [drawSx, drawSy] = markerStart ? pullBack(midX, midY, sx, sy) : [sx, sy]

  const path = `M ${drawSx},${drawSy} Q ${midX},${midY} ${drawTx},${drawTy}`
  // The label sits on the curve itself, not at the bezier control point —
  // for a quadratic curve the midpoint (t=0.5) is halfway between the
  // control point and the chord's midpoint, not the control point itself.
  // Using the control point directly (as before) put the label noticeably
  // further from the line than the line actually bows.
  const labelX = 0.25 * sx + 0.5 * midX + 0.25 * tx
  const labelY = 0.25 * sy + 0.5 * midY + 0.25 * ty

  // The label doubles as the "bend" handle: drag it to bow the curve, or
  // just click it (no real movement) to open the edit popup. Mouse deltas
  // are in screen px, so they're divided by the canvas zoom level to get
  // the equivalent flow-space distance, then projected onto the curve's
  // perpendicular so dragging left/right of the line actually bows it.
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startOffset = offset
    let moved = false
    let latestOffset = startOffset

    const onMove = (ev: PointerEvent) => {
      const dxScreen = ev.clientX - startX
      const dyScreen = ev.clientY - startY
      if (Math.abs(dxScreen) > 3 || Math.abs(dyScreen) > 3) moved = true
      const dxFlow = dxScreen / zoom
      const dyFlow = dyScreen / zoom
      const proj = dxFlow * perpX + dyFlow * perpY
      // *2: the control point moves 2x as far as the curve's own midpoint
      // does, so this keeps the curve tracking the cursor 1:1 while dragging.
      latestOffset = startOffset + proj * 2
      setDragOffset(latestOffset)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDragOffset(null)
      if (moved) edgeData.onBendChange(id, latestOffset)
      else edgeData.onLabelClick(id)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <>
      <BaseEdge path={path} style={style} markerEnd={markerEnd} markerStart={markerStart} />
      <EdgeLabelRenderer>
        <div
          className="rel-edge-label"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            color: edgeData.color,
          }}
          onPointerDown={handlePointerDown}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes = { fanned: FannedEdge }

// Default nodes only get one source handle (bottom) and one target handle
// (top), so you could only ever drag a connection "downward." isConnectableStart
// / isConnectableEnd both default to true regardless of a handle's declared
// type, so a single handle per side is already draggable *and* droppable —
// no need to stack a source+target pair at each position (that was tried
// first and made connections flaky: whichever handle rendered on top
// silently ate the other's pointer events). connectionMode="loose" on
// <ReactFlow> additionally lets source-typed and target-typed handles
// connect to each other freely.
function RelNode({ data }: NodeProps) {
  const label = String((data as { label?: string } | undefined)?.label ?? '')
  return (
    <>
      <Handle type="source" position={Position.Top} id="top" className="rel-handle rel-handle-top" />
      <Handle type="source" position={Position.Right} id="right" className="rel-handle rel-handle-right" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="rel-handle rel-handle-bottom" />
      <Handle type="source" position={Position.Left} id="left" className="rel-handle rel-handle-left" />
      <span>{label}</span>
    </>
  )
}

const nodeTypes = { relNode: RelNode }

function toFlowNodes(nodes: RelationshipNode[], victimId: string | undefined): Node[] {
  return nodes.map(n => ({
    id: n.id,
    type: 'relNode',
    position: { x: n.x, y: n.y },
    data: { label: n.label },
    className: n.id === victimId ? 'rel-node rel-node-victim' : 'rel-node',
  }))
}

export default function RelationshipBoard() {
  const { lang } = useLanguage()
  const { scenario } = useScenario()
  const victimId = scenario?.victim?.id
  const {
    relationshipNodes,
    relationshipEdges,
    moveRelationshipNode,
    addRelationshipNode,
    updateRelationshipNodeLabel,
    removeRelationshipNode,
    addRelationshipEdge,
    updateRelationshipEdge,
    updateRelationshipEdgeOffset,
    removeRelationshipEdge,
  } = useCaseNotes()

  const instanceRef = useRef<ReactFlowInstance | null>(null)
  // A saved victim label may still be the scenario's raw English name; show the Japanese one.
  const victimRawName = scenario?.victim?.name
  const victimJaName = victimRawName ? scenario?.displayNamesJa?.[victimRawName] : undefined
  const shownNodes = useMemo(
    () => relationshipNodes.map(n =>
      lang === 'ja' && n.id === victimId && n.label === victimRawName && victimJaName ? { ...n, label: victimJaName } : n),
    [relationshipNodes, lang, victimId, victimRawName, victimJaName],
  )
  const [nodes, setNodes] = useState<Node[]>(() => toFlowNodes(shownNodes, victimId))
  const [editor, setEditor] = useState<EdgeEditorState | null>(null)
  const [customLabel, setCustomLabel] = useState('')
  const [customColor, setCustomColor] = useState(SWATCHES[0])

  useEffect(() => {
    setNodes(toFlowNodes(shownNodes, victimId))
  }, [shownNodes, victimId])

  // The edge's label doubles as its drag handle (see FannedEdge) — a plain
  // click with no real movement lands here to open the same editor a click
  // on the line itself opens.
  const handleEdgeLabelClick = useCallback((edgeId: string) => {
    const e = relationshipEdges.find(re => re.id === edgeId)
    if (!e) return
    setCustomLabel(e.label)
    setCustomColor(e.color ?? SWATCHES[0])
    setEditor({ mode: 'edit', edgeId: e.id, bidirectional: !!e.bidirectional })
  }, [relationshipEdges])

  const edges: Edge[] = useMemo(() => {
    // Multiple edges between the exact same two nodes draw the exact same
    // line by default, so their labels stack on top of each other and
    // become unreadable. Fan them out with a perpendicular pixel offset per
    // pair, keyed by the unordered node pair so A→B and B→A share a group.
    const pairIndex = new Map<string, number>()
    const pairCounts = new Map<string, number>()
    for (const e of relationshipEdges) {
      const key = [e.source, e.target].sort().join('|')
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
    }

    return relationshipEdges.map(e => {
      const color = e.color ?? '#9c6b1f'
      const key = [e.source, e.target].sort().join('|')
      const total = pairCounts.get(key) ?? 1
      const idx = pairIndex.get(key) ?? 0
      pairIndex.set(key, idx + 1)
      // Once the user has manually dragged this edge's bow, that wins over
      // the automatic multi-edge fan-out — they've already told us exactly
      // where they want it.
      const autoOffset = total > 1 ? (idx - (total - 1) / 2) * 65 : 0
      const offset = e.manualOffset ?? autoOffset

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        // Pin each edge to the exact handle it was drawn from/to — without
        // this, a node with several handles leaves React Flow to guess
        // which one an edge belongs to, and that guess can change (making
        // an unrelated existing edge appear to jump or vanish) as soon as
        // another edge is added to the same node.
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        type: 'fanned',
        data: { color, offset, onBendChange: updateRelationshipEdgeOffset, onLabelClick: handleEdgeLabelClick },
        // markerUnits defaults to "strokeWidth", so with the line's default
        // ~1.5px stroke the arrowhead rendered at only a couple of pixels —
        // technically present but invisible at a glance. Fixed pixel units
        // plus an explicit width/height keep it a clearly visible triangle
        // regardless of the line's own thickness.
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 22, height: 22, markerUnits: 'userSpaceOnUse' },
        markerStart: e.bidirectional
          ? { type: MarkerType.ArrowClosed, color, width: 22, height: 22, markerUnits: 'userSpaceOnUse' }
          : undefined,
        style: { stroke: color, strokeWidth: 2 },
        className: 'rel-edge',
      }
    })
  }, [relationshipEdges, updateRelationshipEdgeOffset, handleEdgeLabelClick])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(prev => applyNodeChanges(changes, prev))
    for (const change of changes) {
      if (change.type === 'position' && change.position && change.dragging === false) {
        moveRelationshipNode(change.id, change.position.x, change.position.y)
      }
      if (change.type === 'remove') {
        removeRelationshipNode(change.id)
      }
    }
  }, [moveRelationshipNode, removeRelationshipNode])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const change of changes) {
      if (change.type === 'remove') removeRelationshipEdge(change.id)
    }
  }, [removeRelationshipEdge])

  const closeEditor = useCallback(() => {
    setEditor(null)
    setCustomLabel('')
    setCustomColor(SWATCHES[0])
  }, [])

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    setEditor({
      mode: 'create',
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      bidirectional: false,
    })
  }, [])

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const e = relationshipEdges.find(re => re.id === edge.id)
    setCustomLabel(String(edge.label ?? ''))
    setCustomColor((edge.data as { color?: string } | undefined)?.color ?? SWATCHES[0])
    setEditor({ mode: 'edit', edgeId: edge.id, bidirectional: !!e?.bidirectional })
  }, [relationshipEdges])

  const handlePaneDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!instanceRef.current) return
    const label = window.prompt(lang === 'ja' ? '追加する人物・要素の名前' : 'Name for the new note')
    if (!label || !label.trim()) return
    const pos = instanceRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    addRelationshipNode(label.trim(), pos.x, pos.y)
  }, [addRelationshipNode, lang])

  const handleAddNodeButton = useCallback(() => {
    const label = window.prompt(lang === 'ja' ? '追加する人物・要素の名前' : 'Name for the new note')
    if (!label || !label.trim()) return
    // Center-ish of the seeded layout, with jitter so repeated adds don't stack exactly.
    const x = 260 + Math.random() * 120 - 60
    const y = 220 + Math.random() * 120 - 60
    addRelationshipNode(label.trim(), x, y)
  }, [addRelationshipNode, lang])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const currentLabel = String((node.data as { label?: string } | undefined)?.label ?? '')
    const next = window.prompt(
      lang === 'ja' ? '名前を編集（空にすると削除）' : 'Edit name (leave empty to delete)',
      currentLabel,
    )
    if (next === null) return
    if (next.trim() === '') removeRelationshipNode(node.id)
    else updateRelationshipNodeLabel(node.id, next.trim())
  }, [lang, removeRelationshipNode, updateRelationshipNodeLabel])

  const confirmEdge = useCallback((label: string, color: string) => {
    if (!editor || !label.trim()) return
    if (editor.mode === 'create') {
      addRelationshipEdge(
        editor.source!, editor.target!, label.trim(), color, editor.bidirectional,
        editor.sourceHandle, editor.targetHandle,
      )
    } else {
      updateRelationshipEdge(editor.edgeId!, label.trim(), color, editor.bidirectional)
    }
    closeEditor()
  }, [editor, addRelationshipEdge, updateRelationshipEdge, closeEditor])

  const handleDeleteEdge = useCallback(() => {
    if (editor?.mode === 'edit') removeRelationshipEdge(editor.edgeId!)
    closeEditor()
  }, [editor, removeRelationshipEdge, closeEditor])

  return (
    <div className="relationship-board">
      <div className="rel-toolbar">
        <p className="rel-hint">
          {lang === 'ja'
            ? 'ドラッグで移動／ハンドルをドラッグして接続／クリックで編集・削除'
            : 'Drag to move · drag a handle to connect · click to edit or delete'}
        </p>
        <button className="rel-add-node-btn" onClick={handleAddNodeButton}>
          {lang === 'ja' ? '＋ 人物・要素を追加' : '+ Add person / note'}
        </button>
      </div>
      <div className="relationship-canvas" onDoubleClick={handlePaneDoubleClick}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onEdgeClick={handleEdgeClick}
          onNodeClick={handleNodeClick}
          onInit={(instance) => { instanceRef.current = instance }}
          colorMode="light"
          fitView
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {editor && (
        <div className="rel-editor-overlay" onClick={closeEditor}>
          <div className="rel-editor-card" onClick={(e) => e.stopPropagation()}>
            <p className="rel-editor-title">
              {editor.mode === 'create'
                ? (lang === 'ja' ? 'この関係を選ぶ' : 'Choose this relationship')
                : (lang === 'ja' ? '関係を編集' : 'Edit relationship')}
            </p>

            <button
              className={`rel-bidir-toggle${editor.bidirectional ? ' active' : ''}`}
              onClick={() => setEditor(prev => prev && { ...prev, bidirectional: !prev.bidirectional })}
            >
              {editor.bidirectional
                ? (lang === 'ja' ? '↔ 双方向（クリックで一方向に）' : '↔ Two-way (click for one-way)')
                : (lang === 'ja' ? '→ 一方向（クリックで双方向に）' : '→ One-way (click for two-way)')}
            </button>

            <div className="rel-preset-grid">
              {EDGE_PRESETS.map((p) => (
                <button
                  key={p.en}
                  className="rel-preset-btn"
                  style={{ borderColor: p.color, color: p.color }}
                  onClick={() => confirmEdge(lang === 'ja' ? p.ja : p.en, p.color)}
                >
                  {lang === 'ja' ? p.ja : p.en}
                </button>
              ))}
            </div>

            <p className="rel-editor-divider">{lang === 'ja' ? 'または自由入力' : 'or write your own'}</p>

            <input
              className="rel-editor-input"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder={lang === 'ja' ? '例：怪しい、内緒で会っていた' : 'e.g. suspicious, secretly meeting'}
            />

            <div className="rel-swatch-row">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  className={`rel-swatch${customColor === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setCustomColor(c)}
                  title={c}
                />
              ))}
            </div>

            <div className="rel-editor-actions">
              {editor.mode === 'edit' && (
                <button className="rel-editor-delete" onClick={handleDeleteEdge}>
                  {lang === 'ja' ? '削除' : 'Delete'}
                </button>
              )}
              <button className="rel-editor-cancel" onClick={closeEditor}>
                {lang === 'ja' ? 'キャンセル' : 'Cancel'}
              </button>
              <button
                className="rel-editor-ok"
                disabled={!customLabel.trim()}
                onClick={() => confirmEdge(customLabel, customColor)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
