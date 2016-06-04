import React, { PropTypes, Component } from 'react';
import d3 from 'd3';
import d3p from 'd3-polygon';
import _ from 'lodash';
import cx from 'classnames';

import NodeModel from '../models/NodeModel';

import './PlotContainer.styl';

export default class PlotContainer extends Component {
  static propTypes = {
    id: PropTypes.number.isRequired,
    done: PropTypes.bool.isRequired,
    graphType: PropTypes.string.isRequired,
    currentId: PropTypes.number.isRequired,
    nodes: PropTypes.array.isRequired,
    components: PropTypes.array,
    visitOrder: PropTypes.array.isRequired,
    addNode: PropTypes.func.isRequired,
    updateNodes: PropTypes.func.isRequired,
    initialiseNodes: PropTypes.func.isRequired
  };

  render() {
    return <div className='PlotContainer' id={`plot${this.props.id}`}></div>;
  }

  componentDidMount() {
    this.props.initialiseNodes(this.getDimensions());
  }

  componentDidUpdate() {
    this.draw();
  }

  getDimensions() {
    var svgElem = d3.select('.PlotContainer').node();
    return {
      x: svgElem.clientWidth,
      y: svgElem.clientHeight
    };
  }

  draw() {
    let self = this;

    d3.selectAll(`.PlotContainer#plot${self.props.id} svg`).remove();

    let svg = d3.select(`.PlotContainer#plot${self.props.id}`)
      .append('svg')
      .classed('done', self.props.done)
      .on('click', function() { // We need this context, cant use ES6 anonymous function
        if (d3.event.defaultPrevented) return;
        let coords = d3.mouse(this);
        self.props.addNode(coords[0], coords[1]);
      });

    let defs = svg.append('defs');

    defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('class', 'ArrowHead')
    .attr('refX', 22) /*must be smarter way to calculate shift*/
    .attr('refY', 4)
    .attr('markerWidth', 12)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
      .attr('d', 'M 0,0 V 8 L12,4 Z'); //this is actual shape for arrowhead

    defs.append('marker')
    .attr('id', 'arrowhead-dragging')
    .attr('class', 'ArrowHead dragging')
    .attr('refX', 10) /*must be smarter way to calculate shift*/
    .attr('refY', 4)
    .attr('markerWidth', 12)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
      .attr('d', 'M 0,0 V 8 L12,4 Z'); //this is actual shape for arrowhead

    defs.append('marker')
    .attr('id', 'arrowhead-traversed')
    .attr('class', 'ArrowHead traversed')
    .attr('refX', 22) /*must be smarter way to calculate shift*/
    .attr('refY', 4)
    .attr('markerWidth', 12)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
      .attr('d', 'M 0,0 V 8 L12,4 Z'); //this is actual shape for arrowhead

    if (this.props.components) {
      this.props.components.forEach(this.drawComponent.bind(this));
    }
    this.props.nodes.forEach(this.drawEdges.bind(this));
    this.props.nodes.forEach(this.drawNode.bind(this));
  }

  drawComponent(component) {
    let svg = d3.select(`.PlotContainer#plot${this.props.id} svg`);

    if (component.length === 1) {
      let node = this.props.nodes.find((n) => n.id === component[0]);
      svg.append('circle')
        .attr('class', 'GraphComponent-circle')
        .attr('cx', node.x)
        .attr('cy', node.y)
        .attr('r', 20);
    } else {
      var points = component.map((c) => {
          let node = this.props.nodes.find((n) => n.id === c);
          return [node.x, node.y].join(',');
      }).join(' ');

      svg.append('polygon')
        .attr('class', 'GraphComponent-poly')
        .attr('points', points);
    }
  }

  drawEdges(node) {
    let self = this;
    let svg = d3.select(`.PlotContainer#plot${this.props.id} svg`);

    node.children.forEach((childId) => {
      let child = self.props.nodes.find((n) => n.id === childId);

      var markerId = (child.visitedFrom === node.id) ? '#arrowhead-traversed': '#arrowhead';


      svg.append('line')
        .attr('class', 'Edge')
        .attr('marker-end', `url(${markerId})`)
        .attr('x1', node.x)
        .attr('y1', node.y)
        .attr('x2', child.x)
        .attr('y2', child.y)
        .classed('traversed', (child.visitedFrom === node.id));
    });
  }

  drawNode(node) {
    let self = this;
    
    let svg = d3.select(`.PlotContainer#plot${self.props.id} svg`);

    let drag = d3.behavior.drag()
      .on('dragstart', function(d) {
        self.props.updateNodes(self.props.nodes.map((n) => {
          if (n.id === node.id) {
            n.selected = true;
          }

          return n;
        }));

        d3.select(`.PlotContainer#plot${self.props.id} svg`)
        .append('line')
          .attr('class', 'Edge dragging')
          .attr('x1', node.x)
          .attr('y1', node.y)
          .attr('x2', node.x)
          .attr('y2', node.y);
      })
      .on('drag', function(d) {
        var draggedLine = d3.select(`.PlotContainer#plot${self.props.id} svg .Edge.dragging`);

        draggedLine
          .attr('marker-end', 'url(#arrowhead-dragging)')
          .attr('x1', node.x)
          .attr('y1', node.y)
          .attr('x2', d3.event.sourceEvent.offsetX - node.size)
          .attr('y2', d3.event.sourceEvent.offsetY - node.size);
      })
      .on('dragend', function(d) {
        d3.event.sourceEvent.stopPropagation();
        d3.selectAll(`.PlotContainer#plot${self.props.id} svg .Edge.dragging`).remove();

        let { offsetX: x, offsetY: y } = d3.event.sourceEvent;
        let connect = self.props.nodes.find((node) => {
          return (
            Math.abs(node.x - x) < node.size &&
            Math.abs(node.y - y) < node.size);
        });

        if (connect && connect.id !== node.id && node.children.filter((c) => c === connect.id).length === 0) {
          self.props.updateNodes(self.props.nodes.map((n) => {
            if (n.id === node.id) {
              n.selected = false;
              n.children.push(connect.id);
            }

            if (self.props.graphType === 'undirected' && n.id === connect.id) {
              n.children.push(node.id);
            }

            return n;
          }));
        }
      });

    let nodeElem = svg.append('circle')
      .attr('class', 'Node')
      .attr('id', 'node-'+node.id)
      .attr('cx', node.x)
      .attr('cy', node.y)
      .attr('r', node.size)
      .classed('selected', node.selected)
      .classed('visited', node.visited)
      .classed('articulationPoint', node.articulationPoint)
      .classed('current', node.current)
      .on('mouseover', function() {
        d3.select(this).classed('hover', true);
      })
      .on('mouseout', function() {
        d3.select(this).classed('hover', false);
      })
      .call(drag);

    svg.append('text')
      .attr('class', 'Node-label')
      .attr('id', 'label-'+node.id)
      .attr('x', node.x + node.size*1.2)
      .attr('y', node.y + node.size*1.5)
      .text(node.id);

    let visited = this.props.visitOrder.findIndex((v) => v.id === node.id);

    if (visited > -1) {
      svg.append('text')
        .attr('class', 'Node-visitLabel')
        .attr('id', 'visitlabel-'+node.id)
        .attr('x', node.x - (node.size*1.5))
        .attr('y', node.y + node.size*1.5)
        .text(visited + 1);
    }
  }
};