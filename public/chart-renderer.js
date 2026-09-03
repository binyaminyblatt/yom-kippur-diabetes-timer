/**
 * ChartRenderer - High-DPI Glucose Trend Visualizer
 * Plots continuous glucose history with target range shading.
 */
class ChartRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.history = [];
    this.targetLow = 70;
    this.targetHigh = 180;
    this.unit = 'mgdl';

    window.addEventListener('resize', () => this.render());
  }

  setData(history, targetLow = 70, targetHigh = 180, unit = 'mgdl') {
    this.history = history || [];
    this.targetLow = targetLow;
    this.targetHigh = targetHigh;
    this.unit = unit;
    this.render();
  }

  render() {
    if (!this.canvas || !this.ctx) return;

    // Handle high DPI retina displays
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width === 0 || height === 0) return;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 35, bottom: 25, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    if (chartW <= 0 || chartH <= 0) return;

    const minGlucose = 40;
    const maxGlucose = 260;

    const getY = (val) => {
      const clamped = Math.max(minGlucose, Math.min(maxGlucose, val));
      const ratio = (clamped - minGlucose) / (maxGlucose - minGlucose);
      return padding.top + chartH * (1 - ratio);
    };

    const getX = (index, total) => {
      if (total <= 1) return padding.left + chartW / 2;
      return padding.left + (index / (total - 1)) * chartW;
    };

    // Draw Target Range Shaded Band (Green Zone: 70 - 180 mg/dL)
    const yHigh = getY(this.targetHigh);
    const yLow = getY(this.targetLow);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    ctx.fillRect(padding.left, yHigh, chartW, yLow - yHigh);

    // Target range boundary lines
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // High target line
    ctx.beginPath();
    ctx.moveTo(padding.left, yHigh);
    ctx.lineTo(padding.left + chartW, yHigh);
    ctx.stroke();

    // Low target line
    ctx.beginPath();
    ctx.moveTo(padding.left, yLow);
    ctx.lineTo(padding.left + chartW, yLow);
    ctx.stroke();
    ctx.setLineDash([]);

    // Y-Axis Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const yMarks = [70, 120, 180, 240];
    yMarks.forEach(mark => {
      const y = getY(mark);
      const displayVal = this.unit === 'mmol' ? (mark / 18.0182).toFixed(1) : mark;
      ctx.fillText(displayVal, padding.left - 8, y);
    });

    if (this.history.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      const noDataText = (typeof window !== 'undefined' && window.i18n) ? window.i18n.t('cgm.noData') : 'No CGM history data available yet';
      ctx.fillText(noDataText, width / 2, height / 2);
      return;
    }

    const dataPoints = this.history;
    const count = dataPoints.length;

    // Draw Trend Line Path
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const pt = dataPoints[i];
      const val = pt.ValueInMgPerDl || pt.Value;
      const x = getX(i, count);
      const y = getY(val);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // Gradient fill under the trend line
    const lastVal = dataPoints[count - 1].ValueInMgPerDl || dataPoints[count - 1].Value;
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    if (lastVal < this.targetLow) {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
      ctx.strokeStyle = '#ef4444';
    } else if (lastVal > this.targetHigh) {
      gradient.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
      gradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
      ctx.strokeStyle = '#f59e0b';
    } else {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      ctx.strokeStyle = '#10b981';
    }

    // Fill area
    ctx.save();
    const fillPath = new Path2D();
    for (let i = 0; i < count; i++) {
      const val = dataPoints[i].ValueInMgPerDl || dataPoints[i].Value;
      const x = getX(i, count);
      const y = getY(val);
      if (i === 0) fillPath.moveTo(x, y);
      else fillPath.lineTo(x, y);
    }
    fillPath.lineTo(getX(count - 1, count), padding.top + chartH);
    fillPath.lineTo(getX(0, count), padding.top + chartH);
    fillPath.closePath();
    ctx.fillStyle = gradient;
    ctx.fill(fillPath);
    ctx.restore();

    // Stroke line
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw Current Glucose Dot (Latest)
    const latestX = getX(count - 1, count);
    const latestY = getY(lastVal);

    // Outer glow
    ctx.beginPath();
    ctx.arc(latestX, latestY, 8, 0, Math.PI * 2);
    ctx.fillStyle = lastVal < this.targetLow ? 'rgba(239,68,68,0.3)' : (lastVal > this.targetHigh ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)');
    ctx.fill();

    // Core dot
    ctx.beginPath();
    ctx.arc(latestX, latestY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // X-Axis Time Labels (e.g. -12h, -6h, -3h, Now)
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const yTime = padding.top + chartH + 8;
    const label12h = (typeof window !== 'undefined' && window.i18n) ? window.i18n.t('cgm.chart12hAgo') : '12h ago';
    const label6h = (typeof window !== 'undefined' && window.i18n) ? window.i18n.t('cgm.chart6hAgo') : '6h ago';
    const labelNow = (typeof window !== 'undefined' && window.i18n) ? window.i18n.t('cgm.chartNow') : 'Now';

    ctx.fillText(label12h, padding.left + 15, yTime);
    ctx.fillText(label6h, padding.left + chartW * 0.5, yTime);
    ctx.fillText(labelNow, padding.left + chartW - 5, yTime);
  }
}

// Global instance
window.ChartRenderer = ChartRenderer;
