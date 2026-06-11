"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Task, TeamMember } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';

const mapDbTaskToClientTask = (t: any, teamList: TeamMember[]): Task => {
  return {
    id: t.id,
    title: t.title,
    note: t.note || '',
    totalSec: t.total_sec || 0,
    elapsedSec: t.elapsed_sec || 0,
    status: t.status,
    tierName: t.tier_name,
    tierVal: Number(t.tier_val || 1.0),
    points: t.points,
    commencementDate: t.commencement_date || t.created_at,
    lastCompletedDate: t.completed_at,
    completedAt: t.completed_at,
    managerViewed: t.manager_viewed,
    ownerId: t.staff_id,
    collaboratorIds: t.collaborator_ids || [],
    collaborators: t.collaborators || [],
    frequency: t.frequency || { type: 'once' },
    isContinuous: t.is_continuous || false,
    workflow: t.workflow || [],
    goldenRuleMinutes: t.golden_rule_minutes,
    isCalibrated: t.is_calibrated,
    actualDurationMinutes: t.actual_duration_minutes,
    efficiencyScore: Number(t.efficiency_score || 1.0),
    impact: t.impact || 'Medium',
    complexity: t.complexity || 'Medium',
    parentTaskId: t.parent_task_id || null,
    entityTag: t.entity_tag || null
  } as Task;
};

interface MacroViewGraphProps {
  tasks: Task[];
  categories: string[];
  team: TeamMember[];
  onClose: () => void;
  onEditTask?: (task: Task) => void;
}

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  type: 'core' | 'category' | 'task';
  status?: string;
  taskObj?: Task;
  queuedCount?: number;
  isGhost?: boolean;
}

interface GraphLink {
  source: string;
  target: string;
}

const getCategoryColor = (folder: string) => {
  const name = (folder || '').toLowerCase();
  if (name.includes('daily')) return '#047857'; // Daily -> Emerald Green
  if (name.includes('e-hailing') || name.includes('hailing') || name.includes('ehailing')) return '#0d9488'; // E-hailing -> Teal
  if (name.includes('consultancy') || name.includes('consulting')) return '#b91c1c'; // Consultancy -> Red
  if (name.includes('software') || name.includes('r&d')) return '#6d28d9'; // Software -> Purple
  if (name.includes('hq') || name.includes('holding') || name.includes('general')) return '#a16207'; // HQ -> Gold
  return '#406c58'; // Fallback Forest Green
};

const parseTaskCategory = (task: Task, teamMembers: TeamMember[]): string => {
  let category = 'ECA HQ';

  if (task.note && task.note.includes('=== METADATA ===')) {
    const parts = task.note.split('=== METADATA ===');
    const meta = parts[parts.length - 1];
    const catMatch = meta.match(/category:\s*(.+)/);
    if (catMatch) category = catMatch[1].trim();
  } else {
    const titleMatch = task.title.match(/^\[([^\]]+)\]/);
    if (titleMatch) {
      category = titleMatch[1].trim();
    } else if (task.ownerId) {
      const owner = teamMembers.find(m => m.id === task.ownerId);
      if (owner && owner.department) {
        category = owner.department.trim();
      }
    }
  }

  // Map legacy categories to the new 5 business folders
  const legacyCats = ['Strategic', 'Operations', 'Marketing', 'Finance', 'R&D', 'General'];
  if (legacyCats.includes(category)) {
    if (category === 'Strategic') category = 'ECA HQ';
    else if (category === 'Operations') category = 'ECA Rental - Daily';
    else if (category === 'Marketing') category = 'Marketing Consultancy';
    else if (category === 'Finance') category = 'ECA HQ';
    else if (category === 'R&D') category = 'Software / R&D';
    else if (category === 'General') category = 'ECA HQ';
  }

  return category;
};

// Derive short initials from any category name
const deriveInitials = (name: string): string => {
  // Custom overrides for well-known categories
  const n = (name || '').toLowerCase();
  if (n.includes('e-hailing') || n.includes('ehailing')) return 'EH';
  if (n.includes('daily')) return 'ED';
  if (n.includes('hq')) return 'HQ';

  // Generic: take first letter of each significant word
  const words = name.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/).filter(w => w.length > 1);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return 'BU';
};

// Color palette for category hubs
const hubColorPalette = [
  '#047857', // Emerald
  '#0d9488', // Teal
  '#b91c1c', // Red
  '#6d28d9', // Purple
  '#a16207', // Gold
  '#2563eb', // Blue
  '#c026d3', // Fuchsia
  '#059669', // Green
];

// Special routing: E-hailing connects through ECA HQ instead of directly to CORE
const SPECIAL_PARENT_ROUTES: Record<string, string> = {
  'ECA Rental - E-hailing': 'ECA HQ',
};

export default function MacroViewGraph({ tasks, categories, team, onClose, onEditTask }: MacroViewGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [fadingTaskIds, setFadingTaskIds] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredTaskNode, setHoveredTaskNode] = useState<GraphNode | null>(null);

  // Pan and Zoom states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const startPanRef = useRef({ x: 0, y: 0 });

  // Dragging node states
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  // Sync prop changes
  useEffect(() => {
    setLocalTasks(prevTasks => {
      if (prevTasks.length === 0) {
        return tasks;
      }
      
      const newFading = new Set<string>();
      const updatedTasksList = prevTasks.map(prevT => {
        const newT = tasks.find(t => t.id === prevT.id);
        if (!newT) {
          newFading.add(prevT.id);
          return prevT;
        }
        if (prevT.status !== 'completed' && newT.status === 'completed') {
          const hasActiveChild = tasks.some(t => t.parentTaskId === newT.id && t.status !== 'completed');
          if (!hasActiveChild) {
            newFading.add(newT.id);
          }
        }
        return newT;
      });

      if (newFading.size > 0) {
        setFadingTaskIds(prev => {
          const next = new Set(prev);
          newFading.forEach(id => next.add(id));
          return next;
        });
        setTimeout(() => {
          setLocalTasks(curr => curr.filter(t => !newFading.has(t.id)));
          setFadingTaskIds(prev => {
            const next = new Set(prev);
            newFading.forEach(id => next.delete(id));
            return next;
          });
        }, 300);
      }
      
      const newAdded = tasks.filter(t => !prevTasks.some(pt => pt.id === t.id));
      return [...updatedTasksList.filter(t => !newAdded.some(na => na.id === t.id)), ...newAdded];
    });
  }, [tasks]);

  // Real-time Supabase subscription
  useEffect(() => {
    const channel = supabase
      .channel('macro-view-tasks-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = mapDbTaskToClientTask(payload.new, team);
            setLocalTasks(prev => {
              if (prev.some(t => t.id === newTask.id)) return prev;
              return [...prev, newTask];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = mapDbTaskToClientTask(payload.new, team);
            const prevTask = localTasks.find(t => t.id === updatedTask.id);
            if (prevTask && prevTask.status !== 'completed' && updatedTask.status === 'completed') {
              const hasActiveChild = localTasks.some(t => t.parentTaskId === updatedTask.id && t.status !== 'completed' && t.id !== updatedTask.id);
              if (!hasActiveChild) {
                setFadingTaskIds(prev => {
                  const next = new Set(prev);
                  next.add(updatedTask.id);
                  return next;
                });
                setTimeout(() => {
                  setLocalTasks(prevList => prevList.filter(t => t.id !== updatedTask.id));
                  setFadingTaskIds(prev => {
                    const next = new Set(prev);
                    next.delete(updatedTask.id);
                    return next;
                  });
                }, 300);
              }
            }
            setLocalTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setFadingTaskIds(prev => {
              const next = new Set(prev);
              next.add(deletedId);
              return next;
            });
            setTimeout(() => {
              setLocalTasks(prev => prev.filter(t => t.id !== deletedId));
              setFadingTaskIds(prev => {
                const next = new Set(prev);
                next.delete(deletedId);
                return next;
              });
            }, 300);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [team, localTasks]);

  // Load completed tasks when toggle is ON
  useEffect(() => {
    if (showCompleted) {
      const fetchCompletedTasks = async () => {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false });

        if (data && !error) {
          const fetchedClientTasks = data.map(t => mapDbTaskToClientTask(t, team));
          setLocalTasks(prev => {
            const prevIds = new Set(prev.map(t => t.id));
            const merged = [...prev];
            fetchedClientTasks.forEach(t => {
              if (!prevIds.has(t.id)) {
                merged.push(t);
              }
            });
            return merged;
          });
        }
      };
      fetchCompletedTasks();
    }
  }, [showCompleted, team]);

  // Initialize graph nodes and links (dynamic constellation layout from real categories)
  useEffect(() => {
    const cx = 400;
    const cy = 300;
    const R_hub = 170; // Orbital radius for category hubs around CORE

    // Create Core Node
    const coreNode: GraphNode = {
      id: 'core',
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      size: 24,
      color: '#06b6d4',
      type: 'core',
      label: 'CORE',
    };

    const newNodes: GraphNode[] = [coreNode];
    const newLinks: GraphLink[] = [];

    // Filter categories to only active ones
    const activeCategories = categories.filter(c => c);

    // Separate top-level categories (connect to CORE) from child-routed ones
    const topLevel = activeCategories.filter(c => !SPECIAL_PARENT_ROUTES[c]);
    const childRouted = activeCategories.filter(c => SPECIAL_PARENT_ROUTES[c]);

    // Compute hub positions dynamically in a radial layout
    const hubCoords: Record<string, { x: number; y: number }> = {};
    topLevel.forEach((cat, idx) => {
      const angle = ((idx / topLevel.length) * 2 * Math.PI) - Math.PI / 2; // start from top
      hubCoords[cat] = {
        x: cx + R_hub * Math.cos(angle),
        y: cy + R_hub * Math.sin(angle),
      };
    });

    // Position child-routed hubs near their parent
    childRouted.forEach((cat) => {
      const parentCat = SPECIAL_PARENT_ROUTES[cat];
      const parentPos = hubCoords[parentCat] || { x: cx, y: cy };
      // Offset from parent
      hubCoords[cat] = {
        x: parentPos.x - 90,
        y: parentPos.y + 70,
      };
    });

    // Build all category hub nodes
    activeCategories.forEach((cat, idx) => {
      const catId = `cat-${cat}`;
      const pos = hubCoords[cat];
      if (!pos) return;

      const catQueuedTasks = localTasks.filter(t => t.status === 'queued' && parseTaskCategory(t, team) === cat);
      const queuedCount = catQueuedTasks.length;
      const catNodeSize = 18 + Math.min(12, queuedCount * 1.5);

      newNodes.push({
        id: catId,
        label: cat, // Use the REAL category name from the database
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        size: catNodeSize,
        color: getCategoryColor(cat) || hubColorPalette[idx % hubColorPalette.length],
        type: 'category',
        queuedCount: queuedCount,
      });

      // Link connection
      const parentCat = SPECIAL_PARENT_ROUTES[cat];
      if (parentCat) {
        newLinks.push({ source: `cat-${parentCat}`, target: catId });
      } else {
        newLinks.push({ source: 'core', target: catId });
      }

      // Create Task Nodes (only queued, running, paused, and fading out)
      const catActiveTasks = localTasks.filter(t => 
        (t.status === 'queued' || t.status === 'running' || t.status === 'paused' || fadingTaskIds.has(t.id)) && 
        parseTaskCategory(t, team) === cat
      );

      // Find completed parent tasks of any active tasks in the category to serve as Ghost Anchors
      const activeTaskParentIds = new Set(catActiveTasks.map(t => t.parentTaskId).filter(Boolean));
      const ghostParentTasks = localTasks.filter(t => 
        t.status === 'completed' && 
        !fadingTaskIds.has(t.id) &&
        activeTaskParentIds.has(t.id) && 
        parseTaskCategory(t, team) === cat
      );

      // Separate into Layer 3 (Parent) and Layer 4 (Child) tasks
      const activeParentTasks = catActiveTasks.filter(t => 
        !t.parentTaskId || !localTasks.some(pt => pt.id === t.parentTaskId)
      );

      // Combine active parent tasks and ghost parent tasks for Layer 3
      const allLayer3Tasks = [...activeParentTasks, ...ghostParentTasks];

      const layer4Tasks = catActiveTasks.filter(t => 
        t.parentTaskId && allLayer3Tasks.some(pt => pt.id === t.parentTaskId)
      );

      const R_parent = 75; // Primary orbit radius
      const R_child = 22;  // Secondary orbit radius

      allLayer3Tasks.forEach((parentTask, parentIndex) => {
        const parentAngle = (parentIndex / allLayer3Tasks.length) * 2 * Math.PI;
        const parentTaskId = `task-${parentTask.id}`;
        const isGhost = parentTask.status === 'completed';

        let parentColor = '#64748b';
        if (isGhost) parentColor = '#475569';
        else if (parentTask.status === 'running') parentColor = '#10b981';
        else if (parentTask.status === 'paused') parentColor = '#f59e0b';

        const parentX = pos.x + R_parent * Math.cos(parentAngle);
        const parentY = pos.y + R_parent * Math.sin(parentAngle);

        newNodes.push({
          id: parentTaskId,
          label: parentTask.title,
          x: parentX,
          y: parentY,
          vx: 0,
          vy: 0,
          size: 10, // Medium-sized node for Layer 3 Parent Task
          color: parentColor,
          type: 'task',
          status: isGhost ? 'completed' : parentTask.status,
          taskObj: parentTask,
          isGhost: isGhost
        });

        newLinks.push({ source: catId, target: parentTaskId });

        // Child Task Satellites around this Parent node
        const children = layer4Tasks.filter(c => c.parentTaskId === parentTask.id);
        children.forEach((childTask, childIndex) => {
          const childAngle = (childIndex / children.length) * 2 * Math.PI;
          const childTaskId = `task-${childTask.id}`;

          let childColor = '#64748b';
          if (childTask.status === 'running') childColor = '#10b981';
          else if (childTask.status === 'paused') childColor = '#f59e0b';

          const childX = parentX + R_child * Math.cos(childAngle);
          const childY = parentY + R_child * Math.sin(childAngle);

          newNodes.push({
            id: childTaskId,
            label: childTask.title,
            x: childX,
            y: childY,
            vx: 0,
            vy: 0,
            size: 5, // Smallest node for Layer 4 Child Task
            color: childColor,
            type: 'task',
            status: childTask.status,
            taskObj: childTask,
          });

          newLinks.push({ source: parentTaskId, target: childTaskId });
        });
      });

      // Create completed task nodes (only if showCompleted is true)
      let catCompletedTasks: Task[] = [];
      if (showCompleted) {
        catCompletedTasks = localTasks.filter(t => 
          t.status === 'completed' && 
          parseTaskCategory(t, team) === cat &&
          !ghostParentTasks.some(gpt => gpt.id === t.id)
        );
      }

      catCompletedTasks.forEach((completedTask, compIndex) => {
        const compAngle = (compIndex / catCompletedTasks.length) * 2 * Math.PI;
        const compTaskId = `task-completed-${completedTask.id}`;

        const compX = pos.x + 125 * Math.cos(compAngle);
        const compY = pos.y + 125 * Math.sin(compAngle);

        newNodes.push({
          id: compTaskId,
          label: completedTask.title,
          x: compX,
          y: compY,
          vx: 0,
          vy: 0,
          size: 6, // 60% the size of active Layer 3 nodes (size: 10)
          color: '#8892B0', // starlight silver / slate blue
          type: 'task',
          status: 'completed',
          taskObj: completedTask,
        });

        newLinks.push({ source: catId, target: compTaskId });
      });
    });

    setNodes(newNodes);
    setLinks(newLinks);
    setSelectedNode(prev => {
      if (!prev) return coreNode;
      const found = newNodes.find(n => n.id === prev.id);
      return found || coreNode;
    });
  }, [localTasks, categories, team, fadingTaskIds, showCompleted]);

  // Handlers for canvas mouse events (Pan & zoom & drag)
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).tagName === 'svg' || (e.target as SVGElement).id === 'grid-bg') {
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;

    if (isPanning) {
      setPan({
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y,
      });
      return;
    }

    if (draggedNodeId) {
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;

      setNodes(prev =>
        prev.map(node =>
          node.id === draggedNodeId
            ? { ...node, x, y, vx: 0, vy: 0 }
            : node
        )
      );
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  const startDragNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
    const clickedNode = nodes.find(n => n.id === nodeId);
    if (clickedNode) setSelectedNode(clickedNode);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const scaleFactor = 0.05;
    const nextZoom = e.deltaY < 0 
      ? Math.min(3, zoom + scaleFactor) 
      : Math.max(0.2, zoom - scaleFactor);
    setZoom(nextZoom);
  };

  const zoomIn = () => setZoom(prev => Math.min(3, prev + 0.2));
  const zoomOut = () => setZoom(prev => Math.max(0.2, prev - 0.2));
  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Link endpoints calculation helper
  const renderedLinks = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return links.map((link, idx) => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) return null;

      const isSpecificRoute = link.source === 'cat-ECA HQ' && link.target === 'cat-ECA Rental - E-hailing';
      const isParentToChild = source.type === 'task' && target.type === 'task';
      const isHubToParent = source.type === 'category' && target.type === 'task';

      const isHistoricalCompleted = (source.status === 'completed' && !source.isGhost) || 
                                     (target.status === 'completed' && !target.isGhost);

      let strokeColor = 'url(#edge-grad)';
      let width = 1.4;
      let opacity = 0.8;

      if (isHistoricalCompleted) {
        strokeColor = '#8892B0';
        width = 0.5;
        opacity = 0.08;
      } else if (isSpecificRoute) {
        strokeColor = '#0d9488';
        width = 2.5;
        opacity = 0.95;
      } else if (isParentToChild) {
        strokeColor = '#94a3b8'; // slate 400
        width = 0.7;
        opacity = 0.45;
      } else if (isHubToParent) {
        strokeColor = 'url(#edge-grad)';
        width = 1.6;
        opacity = 0.85;
      } else if (source.type === 'core' || target.type === 'core') {
        strokeColor = 'url(#edge-grad)';
        width = 2.2;
        opacity = 0.9;
      }

      const isFading = (source.taskObj && fadingTaskIds.has(source.taskObj.id)) || 
                       (target.taskObj && fadingTaskIds.has(target.taskObj.id));

      return (
        <line
          key={`link-${idx}`}
          x1={source.x}
          y1={source.y}
          x2={target.x}
          y2={target.y}
          stroke={strokeColor}
          strokeWidth={width}
          strokeOpacity={isFading ? 0 : opacity}
          style={{
            transition: 'x1 0.3s ease-in-out, y1 0.3s ease-in-out, x2 0.3s ease-in-out, y2 0.3s ease-in-out, stroke-opacity 0.3s ease-in-out'
          }}
          markerEnd={isSpecificRoute ? 'url(#arrow)' : undefined}
        />
      );
    }).filter(Boolean);
  }, [nodes, links, fadingTaskIds]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = localTasks.length;
    const completed = localTasks.filter(t => t.status === 'completed').length;
    const running = localTasks.filter(t => t.status === 'running').length;
    const paused = localTasks.filter(t => t.status === 'paused').length;
    const queued = localTasks.filter(t => t.status === 'queued').length;
    return {
      total,
      completed,
      running,
      paused,
      queued,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [localTasks]);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-all duration-300">
      <div 
        ref={containerRef}
        className="bg-[#0b0f19] border border-slate-800 rounded-[32px] w-full max-w-6xl h-[85vh] shadow-2xl flex overflow-hidden relative select-none"
      >
        {/* Main interactive SVG Panel (Obsidian view) */}
        <div className="flex-1 h-full relative overflow-hidden bg-[#030712]">
          
          {/* Header Title */}
          <div className="absolute top-6 left-6 z-10">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2 font-headline">
              <span className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_#22d3ee]"></span>
              Macro View Network
            </h3>
            <p className="text-[9px] text-slate-500 font-black tracking-widest uppercase mt-1">Obsidian graph layout · Static constellation</p>
          </div>

          {/* Floating Zoom controls */}
          <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
            <button 
              onClick={zoomIn} 
              className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center cursor-pointer transition-all hover:bg-slate-800 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
            <button 
              onClick={zoomOut} 
              className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center cursor-pointer transition-all hover:bg-slate-800 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <button 
              onClick={resetZoom} 
              className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-[8px] font-black uppercase text-slate-400 hover:text-slate-100 flex items-center justify-center cursor-pointer transition-all hover:bg-slate-800 active:scale-95"
            >
              Center
            </button>
          </div>

          {/* SVG canvas */}
          <svg
            ref={svgRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <defs>
              {/* Background grid */}
              <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#1e293b" fillOpacity="0.4" />
              </pattern>
              
              {/* Node glow filters */}
              <filter id="glow-core" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-task" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Glowing gradient for edges */}
              <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
              </linearGradient>

              {/* Specific Route Arrow Marker */}
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="23"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0d9488" />
              </marker>
            </defs>

            {/* Grid pattern background */}
            <rect id="grid-bg" width="100%" height="100%" fill="url(#grid-pattern)" />

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Edges layer */}
              {renderedLinks}

              {/* Nodes layer */}
              {nodes.map(node => {
                const isSelected = selectedNode?.id === node.id;
                
                if (node.type === 'core') {
                  return (
                    <g 
                      key={node.id} 
                      transform={`translate(${node.x}, ${node.y})`}
                      onMouseDown={(e) => startDragNode(e, node.id)}
                      className="cursor-pointer"
                      style={{
                        transition: draggedNodeId === node.id ? 'none' : 'transform 0.3s ease-in-out'
                      }}
                    >
                      <circle 
                        r={node.size + 6} 
                        fill="rgba(6, 182, 212, 0.12)" 
                        stroke="#06b6d4" 
                        strokeWidth="1" 
                        strokeDasharray="4 4" 
                        className="animate-spin"
                        style={{ transformOrigin: 'center', animationDuration: '20s' }}
                      />
                      <circle 
                        r={node.size} 
                        fill="#0b0f19" 
                        stroke="#22d3ee" 
                        strokeWidth="3" 
                        filter="url(#glow-core)"
                        className="transition-colors hover:stroke-cyan-300"
                      />
                      <text 
                        textAnchor="middle" 
                        dy=".3em" 
                        fill="#e2e8f0" 
                        fontSize="8px" 
                        fontWeight="900" 
                        letterSpacing="0.1em"
                        className="pointer-events-none select-none font-headline uppercase"
                      >
                        CORE
                      </text>
                    </g>
                  );
                }

                if (node.type === 'category') {
                  // Derive initials dynamically from the real category name
                  const initials = deriveInitials(node.label);

                  return (
                    <g 
                      key={node.id} 
                      transform={`translate(${node.x}, ${node.y})`}
                      onMouseDown={(e) => startDragNode(e, node.id)}
                      className="cursor-pointer"
                      style={{
                        transition: draggedNodeId === node.id ? 'none' : 'transform 0.3s ease-in-out'
                      }}
                    >
                      {/* Pulse Ring for pending tasks */}
                      {node.queuedCount && node.queuedCount > 0 ? (
                        <circle
                          r={node.size + 5}
                          fill="none"
                          stroke={node.color}
                          strokeWidth="1"
                          strokeDasharray="3 3"
                          className="animate-pulse opacity-60 pointer-events-none"
                        />
                      ) : null}
                      <circle 
                        r={node.size} 
                        fill="#0b0f19" 
                        stroke={node.color} 
                        strokeWidth={isSelected ? "3.5" : "2"} 
                        className="transition-all hover:scale-105"
                      />
                      <text 
                        textAnchor="middle" 
                        dy=".35em" 
                        fill="#f8fafc" 
                        fontSize="9px" 
                        fontWeight="bold"
                        className="pointer-events-none select-none"
                      >
                        {initials}
                      </text>
                      {/* Category Label Below */}
                      <text
                        textAnchor="middle"
                        y={node.size + 14}
                        fill="#94a3b8"
                        fontSize="8px"
                        fontWeight="bold"
                        letterSpacing="0.05em"
                        className="pointer-events-none select-none font-headline uppercase"
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                }

                // Task Satellites Node (Strict Rule: completely blank, minimalistic dots color-coded by status)
                if (node.type === 'task') {
                  const isGhost = node.isGhost;
                  const isFading = node.taskObj ? fadingTaskIds.has(node.taskObj.id) : false;
                  const isHistoricalCompleted = node.status === 'completed' && !isGhost;
                  const isHovered = hoveredTaskNode?.id === node.id;

                  let opacityVal = isGhost ? 0.45 : 1;
                  if (isHistoricalCompleted) {
                    opacityVal = isHovered ? 1 : 0.6;
                  }

                  return (
                    <g 
                      key={node.id} 
                      transform={`translate(${node.x}, ${node.y})`}
                      onMouseDown={(e) => startDragNode(e, node.id)}
                      onMouseEnter={() => setHoveredTaskNode(node)}
                      onMouseLeave={() => setHoveredTaskNode(null)}
                      className="cursor-pointer"
                      style={{
                        transition: draggedNodeId === node.id ? 'none' : 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out',
                        opacity: isFading ? 0 : opacityVal
                      }}
                    >
                      {isGhost ? (
                        <circle 
                          r={node.size} 
                          fill="rgba(71, 85, 105, 0.05)" 
                          stroke={node.color} 
                          strokeWidth="1.5" 
                          strokeDasharray="3 3"
                          strokeOpacity="0.45"
                          className="transition-all hover:scale-150"
                        />
                      ) : isHistoricalCompleted ? (
                        <circle 
                          r={node.size} 
                          fill="#8892B0"
                          stroke="rgba(255, 255, 255, 0.2)"
                          strokeWidth="1"
                          filter={isHovered ? "url(#glow-task)" : undefined}
                          className="transition-all hover:scale-150 hover:fill-slate-100"
                        />
                      ) : (
                        <circle 
                          r={node.size} 
                          fill={node.color} 
                          stroke={isSelected ? "#f8fafc" : node.color} 
                          strokeWidth={isSelected ? "2" : "0"} 
                          filter="url(#glow-task)"
                          className="transition-all hover:scale-150 hover:brightness-125"
                        />
                      )}
                    </g>
                  );
                }

                return null;
              })}
            </g>
          </svg>

          {/* Frosted Glassmorphism Hover Tooltip (glowing constellation lines visible underneath) */}
          {hoveredTaskNode && hoveredTaskNode.taskObj && (
            <div 
              className="absolute z-50 p-4 rounded-2xl bg-slate-950/70 backdrop-blur-xl border border-white/10 shadow-2xl text-left text-xs pointer-events-none select-none max-w-xs transition-all duration-200"
              style={{
                left: `${hoveredTaskNode.x * zoom + pan.x}px`,
                top: `${hoveredTaskNode.y * zoom + pan.y - 12}px`,
                transform: 'translate(-50%, -100%)',
                boxShadow: `0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px 1px ${hoveredTaskNode.color}25`
              }}
            >
              {/* Header Status */}
              <div className="flex items-center justify-between gap-3 mb-2 border-b border-white/10 pb-1.5">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 font-headline">Task Satellites</span>
                <span 
                  className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider text-slate-950 font-headline"
                  style={{ backgroundColor: hoveredTaskNode.color }}
                >
                  {hoveredTaskNode.status}
                </span>
              </div>

              {/* Task Title */}
              <h4 className="text-xs font-bold text-slate-100 break-words leading-snug mb-2.5">
                {hoveredTaskNode.taskObj.title}
              </h4>

              {/* Directives */}
              {hoveredTaskNode.taskObj.note && (
                <div className="mb-2.5">
                  <span className="text-[7px] font-black uppercase tracking-wider text-slate-550 block mb-0.5 font-headline">Directives</span>
                  <p className="text-[9px] text-slate-300 leading-normal break-words font-medium whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar">
                    {hoveredTaskNode.taskObj.note.split('=== METADATA ===')[0].trim() || 'No additional directives.'}
                  </p>
                </div>
              )}

              {/* Entity Tag */}
              {hoveredTaskNode.taskObj.entityTag && (
                <div className="mb-2.5">
                  <span className="text-[7px] font-black uppercase tracking-wider text-slate-550 block mb-0.5 font-headline">Entity Tag</span>
                  <span className="inline-block text-[9px] font-black uppercase tracking-widest text-[#22d3ee] bg-[#22d3ee]/10 px-2 py-0.5 rounded border border-[#22d3ee]/20">
                    {hoveredTaskNode.taskObj.entityTag}
                  </span>
                </div>
              )}

              {/* Assigned Staff */}
              <div>
                <span className="text-[7px] font-black uppercase tracking-wider text-slate-550 block mb-0.5 font-headline">Assigned Lead</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {(() => {
                    const assignedMember = team.find(m => m.id === hoveredTaskNode.taskObj?.ownerId);
                    if (assignedMember) {
                      return (
                        <>
                          <img src={assignedMember.imgUrl} className="w-4.5 h-4.5 rounded-full object-cover border border-white/10" alt="" />
                          <div>
                            <span className="text-[9px] font-semibold text-slate-200 block leading-tight">{assignedMember.name}</span>
                            <span className="text-[7px] text-slate-500 font-black uppercase tracking-wider block mt-0.5">{assignedMember.department}</span>
                          </div>
                        </>
                      );
                    }
                    return <span className="text-[9px] text-slate-500 italic">Unassigned Spec</span>;
                  })()}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Info Details Panel (Glassmorphism Sidebar) */}
        <div className="w-80 h-full border-l border-slate-800 bg-[#090d16]/80 backdrop-blur-xl flex flex-col justify-between p-6 z-20 shrink-0">
          
          {/* Top Info Header */}
          <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 font-headline">Operations Board</h4>
                <p className="text-[10px] text-slate-500 font-black uppercase mt-1">Status Summary</p>
              </div>
              <button 
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] block">close</span>
              </button>
            </div>

            {/* Completion Progress Bar */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-400">Total Progress</span>
                <span className="text-emerald-400">{stats.percent}%</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-1000 shadow-[0_0_10px_#10b981]"
                  style={{ width: `${stats.percent}%` }}
                ></div>
              </div>
              
              {/* Small Stats Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl text-center">
                  <span className="text-xs font-bold text-slate-300 font-mono block leading-none">{stats.completed}</span>
                  <span className="text-[7px] font-black uppercase tracking-wider text-slate-500 mt-1 block">Completed</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl text-center">
                  <span className="text-xs font-bold text-emerald-500 font-mono block leading-none">{stats.running}</span>
                  <span className="text-[7px] font-black uppercase tracking-wider text-slate-500 mt-1 block">Running</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl text-center">
                  <span className="text-xs font-bold text-amber-500 font-mono block leading-none">{stats.paused}</span>
                  <span className="text-[7px] font-black uppercase tracking-wider text-slate-500 mt-1 block">Paused</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl text-center">
                  <span className="text-xs font-bold text-slate-400 font-mono block leading-none">{stats.queued}</span>
                  <span className="text-[7px] font-black uppercase tracking-wider text-slate-500 mt-1 block">Queued</span>
                </div>
              </div>
            </div>

            {/* Dynamic Node Details panel */}
            <div className="border-t border-slate-800 pt-6 space-y-4">
              <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-headline">Node Inspector</h5>
              
              {/* Show Historical Orbit (Completed) Switch */}
              <div className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-headline">Show Historical Orbit</span>
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer outline-none ${showCompleted ? 'bg-cyan-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-slate-100 transition-transform ${showCompleted ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {selectedNode ? (
                <div className="p-4 bg-slate-900/40 border border-slate-800/70 rounded-2xl space-y-3.5 text-left animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span 
                      className="text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-widest text-slate-950 font-headline"
                      style={{ 
                        backgroundColor: 
                          selectedNode.type === 'core' ? '#22d3ee' :
                          selectedNode.type === 'category' ? selectedNode.color : 
                          selectedNode.type === 'task' ? selectedNode.color : '#475569',
                      }}
                    >
                      {selectedNode.type === 'core' ? 'Core' : selectedNode.type === 'category' ? 'Business Hub' : 'Task Satellite'}
                    </span>
                    {selectedNode.type === 'task' && (
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        {selectedNode.status}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-200 break-words leading-tight">{selectedNode.label}</h4>
                    {selectedNode.taskObj && (
                      <p className="text-[8px] font-black uppercase tracking-widest text-cyan-400">+{selectedNode.taskObj.points} MP</p>
                    )}
                  </div>

                  {selectedNode.taskObj && (
                    <div className="space-y-3 pt-2 border-t border-slate-900">
                      {selectedNode.taskObj.note && (
                        <div className="space-y-1">
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-550 block">Directives</span>
                          <p className="text-[10px] text-slate-400 font-medium line-clamp-4 leading-normal break-words">
                            {selectedNode.taskObj.note.split('=== METADATA ===')[0].trim() || 'No additional directives.'}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                        <div>
                          <span className="text-[8px] font-black text-slate-550 block mb-0.5">Impact</span>
                          <span className="text-slate-300 font-semibold">{selectedNode.taskObj.impact}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black text-slate-550 block mb-0.5">Complexity</span>
                          <span className="text-slate-300 font-semibold">{selectedNode.taskObj.complexity}</span>
                        </div>
                      </div>

                      {onEditTask && (
                        <button
                          onClick={() => {
                            if (selectedNode.taskObj) onEditTask(selectedNode.taskObj);
                          }}
                          className="w-full mt-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-slate-100 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700/60 active:scale-[0.98]"
                        >
                          <span className="material-symbols-outlined text-[13px]">edit</span> Edit Task Spec
                        </button>
                      )}
                    </div>
                  )}

                  {selectedNode.type === 'category' && (
                    <div className="space-y-3 pt-1">
                      <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                        Operational directory grouping tasks related to <strong>{selectedNode.label}</strong> business initiatives.
                      </p>
                      <div className="p-3 bg-slate-950/50 border border-slate-900 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-slate-400">
                          <span>Queued/Pending Tasks:</span>
                          <span className="text-teal-400 font-bold">{selectedNode.queuedCount || 0}</span>
                        </div>
                        {selectedNode.queuedCount && selectedNode.queuedCount > 0 ? (
                          <p className="text-[8px] text-slate-500 italic">
                            The node size and dashed outer ring pulse to represent these {selectedNode.queuedCount} pending tasks.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'core' && (
                    <p className="text-[10px] text-slate-400 leading-relaxed pt-1 font-medium">
                      The central KPI merit core coordinating cross-business folder directives and strategic objectives.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic text-center py-6">Select a node to inspect details.</p>
              )}
            </div>
          </div>

          {/* Obsidian Footer Legend */}
          <div className="border-t border-slate-800 pt-5 mt-5">
            <h5 className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-3 block">Color Key Legend</h5>
            <div className="flex flex-wrap gap-2.5 text-[8px] font-black uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#10b981]"></span> Running</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span> Paused</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#64748b]"></span> Queued</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]"></span> Core System</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-teal-500/60 bg-[#0b0f19]"></span> Business Hub</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
