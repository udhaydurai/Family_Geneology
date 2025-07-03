import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Person, Relationship } from '@/types/family';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Settings, Image, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HighResExportProps {
  people: Person[];
  relationships: Relationship[];
}

interface ExportSettings {
  width: number;
  height: number;
  scale: number;
  format: 'png' | 'svg' | 'pdf';
  includeLabels: boolean;
  backgroundColor: string;
}

export const HighResExport: React.FC<HighResExportProps> = ({
  people,
  relationships
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<ExportSettings>({
    width: 2400,
    height: 1600,
    scale: 2,
    format: 'png',
    includeLabels: true,
    backgroundColor: '#ffffff'
  });
  const { toast } = useToast();

  // Manual layout state
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Helper to get node positions (manual or auto)
  const getNodesWithPositions = useCallback((autoLayout = false) => {
    let nodes = people.map(person => ({ ...person, id: person.id }));
    if (!autoLayout && Object.keys(nodePositions).length === people.length) {
      // Use manual positions
      nodes = nodes.map(n => ({ ...n, ...nodePositions[n.id] }));
    } else {
      // Use D3 to generate positions
      const links = relationships.map(rel => ({
        source: rel.personId,
        target: rel.relatedPersonId,
        type: rel.relationshipType
      }));
      // Run simulation
      const simulation = d3.forceSimulation(nodes as any)
        .force('link', d3.forceLink(links as any).id((d: any) => d.id).distance(200))
        .force('charge', d3.forceManyBody().strength(-600))
        .force('center', d3.forceCenter(settings.width / 2, settings.height / 2))
        .force('collide', d3.forceCollide(60))
        .stop();
      for (let i = 0; i < 300; ++i) simulation.tick();
      nodes = nodes.map(n => ({ ...n }));
    }
    return nodes;
  }, [people, relationships, nodePositions, settings.width, settings.height]);

  // Initialize node positions on first render or when people change
  useEffect(() => {
    if (people.length === 0) return;
    const nodes = getNodesWithPositions(true); // auto layout
    const pos: Record<string, { x: number; y: number }> = {};
    nodes.forEach(n => {
      pos[n.id] = { x: (n as any).x, y: (n as any).y };
    });
    setNodePositions(pos);
  }, [people, relationships, settings.width, settings.height]);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setIsDragging(id);
    const svgRect = (svgRef.current as SVGSVGElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - nodePositions[id].x - svgRect.left,
      y: e.clientY - nodePositions[id].y - svgRect.top
    });
  };
  const handleDrag = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const svgRect = (svgRef.current as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - svgRect.left - dragOffset.x;
    const y = e.clientY - svgRect.top - dragOffset.y;
    setNodePositions(pos => ({ ...pos, [isDragging]: { x, y } }));
  };
  const handleDragEnd = () => {
    setIsDragging(null);
  };

  // Reset/Auto Layout
  const handleResetLayout = () => {
    const nodes = getNodesWithPositions(true); // auto layout
    const pos: Record<string, { x: number; y: number }> = {};
    nodes.forEach(n => {
      pos[n.id] = { x: (n as any).x, y: (n as any).y };
    });
    setNodePositions(pos);
  };

  const runSimulation = (nodes: any[], links: any[], width: number, height: number) => {
    return new Promise<any[]>((resolve) => {
      const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id((d: any) => d.id).distance(200))
        .force('charge', d3.forceManyBody().strength(-600))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide(60))
        .stop();
      // Run the simulation for a fixed number of ticks (to completion)
      for (let i = 0; i < 300; ++i) simulation.tick();
      resolve(nodes);
    });
  };

  const generateHighResImage = async () => {
    if (!canvasRef.current || people.length === 0) return;
    setIsGenerating(true);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      canvas.width = settings.width * settings.scale;
      canvas.height = settings.height * settings.scale;
      ctx.setTransform(settings.scale, 0, 0, settings.scale, 0, 0);
      ctx.fillStyle = settings.backgroundColor;
      ctx.fillRect(0, 0, settings.width, settings.height);
      const nodes = getNodesWithPositions();
      const links = relationships.map(rel => ({
        source: rel.personId,
        target: rel.relatedPersonId,
        type: rel.relationshipType
      }));
      // Run simulation and wait for layout
      await runSimulation(nodes, links, settings.width, settings.height);
      // Draw links
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      links.forEach((link: any) => {
        const source = nodes.find(n => n.id === (typeof link.source === 'object' ? (link.source as any).id : link.source));
        const target = nodes.find(n => n.id === (typeof link.target === 'object' ? (link.target as any).id : link.target));
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo((source as any).x, (source as any).y);
          ctx.lineTo((target as any).x, (target as any).y);
          ctx.stroke();
        }
      });
      // Draw nodes
      ctx.globalAlpha = 1;
      (nodes as any[]).forEach((node) => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 24, 0, 2 * Math.PI);
        switch (node.gender) {
          case 'male': ctx.fillStyle = '#3b82f6'; break;
          case 'female': ctx.fillStyle = '#ec4899'; break;
          default: ctx.fillStyle = '#8b5cf6';
        }
        ctx.fill();
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = node.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
        ctx.fillText(initials, node.x, node.y);
        if (settings.includeLabels) {
          ctx.fillStyle = '#222';
          ctx.font = '12px Arial';
          ctx.fillText(node.name, node.x, node.y + 32);
        }
      });
      if (settings.includeLabels) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        links.forEach((link: any) => {
          const source = nodes.find(n => n.id === (typeof link.source === 'object' ? (link.source as any).id : link.source));
          const target = nodes.find(n => n.id === (typeof link.target === 'object' ? (link.target as any).id : link.target));
          if (source && target) {
            const x = ((source as any).x + (target as any).x) / 2;
            const y = ((source as any).y + (target as any).y) / 2 - 14;
            ctx.fillText(link.type.charAt(0).toUpperCase() + link.type.slice(1), x, y);
          }
        });
      }
      toast({
        title: "Image Generated",
        description: "High-resolution family tree image is ready for download"
      });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate high-resolution image",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    
    if (settings.format === 'png') {
      link.download = `family_tree_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
    } else if (settings.format === 'svg') {
      // For SVG, we'd need to generate SVG content
      // This is a simplified version
      link.download = `family_tree_${new Date().toISOString().split('T')[0]}.svg`;
      link.href = canvas.toDataURL('image/svg+xml');
    }
    
    link.click();
  };

  const downloadSVG = () => {
    if (!svgRef.current) return;
    
    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const link = document.createElement('a');
    link.href = svgUrl;
    link.download = `family_tree_${new Date().toISOString().split('T')[0]}.svg`;
    link.click();
    
    URL.revokeObjectURL(svgUrl);
  };

  const generateSVG = async () => {
    if (!svgRef.current || people.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', settings.width).attr('height', settings.height);
    const nodes = getNodesWithPositions();
    const links = relationships.map(rel => ({
      source: rel.personId,
      target: rel.relatedPersonId,
      type: rel.relationshipType
    }));
    // Run simulation and wait for layout
    await runSimulation(nodes, links, settings.width, settings.height);
    // Draw links
    const linkGroup = svg.append('g');
    const link = linkGroup
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('opacity', 0.7)
      .attr('x1', (d: any) => {
        const source = nodes.find(n => n.id === (typeof d.source === 'object' ? (d.source as any).id : d.source));
        return (source as any)?.x || 0;
      })
      .attr('y1', (d: any) => {
        const source = nodes.find(n => n.id === (typeof d.source === 'object' ? (d.source as any).id : d.source));
        return (source as any)?.y || 0;
      })
      .attr('x2', (d: any) => {
        const target = nodes.find(n => n.id === (typeof d.target === 'object' ? (d.target as any).id : d.target));
        return (target as any)?.x || 0;
      })
      .attr('y2', (d: any) => {
        const target = nodes.find(n => n.id === (typeof d.target === 'object' ? (d.target as any).id : d.target));
        return (target as any)?.y || 0;
      });
    // Draw nodes
    const nodeGroup = svg.append('g');
    const node = nodeGroup
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('transform', (d: any) => `translate(${(d as any).x},${(d as any).y})`);
    node.append('circle')
      .attr('r', 24)
      .attr('fill', (d: any) => {
        switch (d.gender) {
          case 'male': return '#3b82f6';
          case 'female': return '#ec4899';
          default: return '#8b5cf6';
        }
      })
      .attr('stroke', '#374151')
      .attr('stroke-width', 2);
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', 'white')
      .text((d: any) => d.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2));
    if (settings.includeLabels) {
      node.append('text')
        .attr('y', 32)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#222')
        .text((d: any) => d.name);
    }
    if (settings.includeLabels) {
      const linkLabelGroup = linkGroup
        .selectAll('text.link-label')
        .data(links)
        .enter().append('text')
        .attr('class', 'link-label')
        .attr('font-size', '10px')
        .attr('fill', '#6b7280')
        .attr('text-anchor', 'middle')
        .attr('alignment-baseline', 'middle')
        .attr('x', (d: any) => {
          const source = nodes.find(n => n.id === (typeof d.source === 'object' ? (d.source as any).id : d.source));
          const target = nodes.find(n => n.id === (typeof d.target === 'object' ? (d.target as any).id : d.target));
          return source && target ? ((source as any).x + (target as any).x) / 2 : 0;
        })
        .attr('y', (d: any) => {
          const source = nodes.find(n => n.id === (typeof d.source === 'object' ? (d.source as any).id : d.source));
          const target = nodes.find(n => n.id === (typeof d.target === 'object' ? (d.target as any).id : d.target));
          return source && target ? ((source as any).y + (target as any).y) / 2 - 14 : 0;
        })
        .text((d: any) => d.type.charAt(0).toUpperCase() + d.type.slice(1));
    }
  };

  useEffect(() => {
    if (people.length > 0) {
      generateSVG();
    }
  }, [people, relationships, settings]);

  // For export, use manual positions if available
  const getExportNodes = () => {
    if (Object.keys(nodePositions).length === people.length) {
      return people.map(person => ({ ...person, id: person.id, x: nodePositions[person.id].x, y: nodePositions[person.id].y }));
    } else {
      // fallback to auto layout
      return getNodesWithPositions(true);
    }
  };

  // Replace preview SVG rendering with manual layout
  const previewNodes = getNodesWithPositions();
  const previewLinks = relationships.map(rel => ({
    source: rel.personId,
    target: rel.relatedPersonId,
    type: rel.relationshipType
  }));

  if (people.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Image className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">No Data to Export</h3>
            <p className="text-muted-foreground">Add some people to your family tree first</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Export Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Width (px)</label>
              <input
                type="number"
                value={settings.width}
                onChange={(e) => setSettings(prev => ({ ...prev, width: parseInt(e.target.value) || 2400 }))}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                min="800"
                max="4000"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Height (px)</label>
              <input
                type="number"
                value={settings.height}
                onChange={(e) => setSettings(prev => ({ ...prev, height: parseInt(e.target.value) || 1600 }))}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                min="600"
                max="3000"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Scale</label>
              <input
                type="number"
                value={settings.scale}
                onChange={(e) => setSettings(prev => ({ ...prev, scale: parseFloat(e.target.value) || 2 }))}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                min="1"
                max="4"
                step="0.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Format</label>
              <select
                value={settings.format}
                onChange={(e) => setSettings(prev => ({ ...prev, format: e.target.value as 'png' | 'svg' }))}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.includeLabels}
                onChange={(e) => setSettings(prev => ({ ...prev, includeLabels: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Include Labels</span>
            </label>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm">Background:</label>
              <input
                type="color"
                value={settings.backgroundColor}
                onChange={(e) => setSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                className="w-8 h-8 border border-gray-300 rounded"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4 mt-4">
            <Button variant="outline" onClick={handleResetLayout}>
              Reset Layout
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview (Drag nodes to adjust layout)</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="border border-gray-200 rounded-lg overflow-hidden bg-white"
            style={{ cursor: isDragging ? 'grabbing' : 'default' }}
            onMouseMove={handleDrag}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
          >
            <svg
              ref={svgRef}
              width={Math.min(settings.width, 800)}
              height={Math.min(settings.height, 600)}
              className="w-full h-auto"
              style={{ touchAction: 'none' }}
            >
              {/* Draw links */}
              {previewLinks.map((link, i) => {
                const source = previewNodes.find(n => n.id === link.source);
                const target = previewNodes.find(n => n.id === link.target);
                if (!source || !target) return null;
                return (
                  <line
                    key={i}
                    x1={(source as any).x}
                    y1={(source as any).y}
                    x2={(target as any).x}
                    y2={(target as any).y}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    opacity={0.7}
                  />
                );
              })}
              {/* Draw nodes */}
              {previewNodes.map((node, i) => (
                <g
                  key={node.id}
                  transform={`translate(${(node as any).x},${(node as any).y})`}
                  style={{ cursor: 'grab' }}
                  onMouseDown={e => handleDragStart(e, node.id)}
                >
                  <circle
                    r={24}
                    fill={node.gender === 'male' ? '#3b82f6' : node.gender === 'female' ? '#ec4899' : '#8b5cf6'}
                    stroke="#374151"
                    strokeWidth={2}
                  />
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    fontSize={14}
                    fontWeight={600}
                    fill="white"
                  >
                    {node.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)}
                  </text>
                  {settings.includeLabels && (
                    <text
                      y={32}
                      textAnchor="middle"
                      fontSize={12}
                      fill="#222"
                    >
                      {node.name}
                    </text>
                  )}
                </g>
              ))}
              {/* Draw relationship labels */}
              {settings.includeLabels && previewLinks.map((link, i) => {
                const source = previewNodes.find(n => n.id === link.source);
                const target = previewNodes.find(n => n.id === link.target);
                if (!source || !target) return null;
                const x = ((source as any).x + (target as any).x) / 2;
                const y = ((source as any).y + (target as any).y) / 2 - 14;
                return (
                  <text
                    key={i + '-label'}
                    x={x}
                    y={y}
                    fontSize={10}
                    fill="#6b7280"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                  >
                    {link.type.charAt(0).toUpperCase() + link.type.slice(1)}
                  </text>
                );
              })}
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Export Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={generateHighResImage}
              disabled={isGenerating}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Image className="w-4 h-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Generate High-Res PNG'}
            </Button>
            
            <Button
              onClick={downloadImage}
              disabled={isGenerating}
              variant="outline"
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PNG
            </Button>
            
            <Button
              onClick={downloadSVG}
              variant="outline"
              className="flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              Download SVG
            </Button>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>PNG:</strong> High-resolution image, perfect for printing and sharing</p>
            <p><strong>SVG:</strong> Vector format, can be scaled infinitely without quality loss</p>
          </div>
        </CardContent>
      </Card>

      {/* Hidden canvas for PNG generation */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}; 