export class ProgressBar {
  private name: string;
  private total: number;
  private current: number;
  private barLength: number;
  private startTime: number;

  constructor(name: string, total: number, barLength: number = 40) {
    this.name = name;
    this.total = total;
    this.current = 0;
    this.barLength = barLength;
    this.startTime = Date.now();
    this.render();
  }

  update(current: number): void {
    this.current = current;
    this.render();
  }

  increment(): void {
    this.current++;
    this.render();
  }

  private render(): void {
    const percentage = this.total > 0 ? this.current / this.total : 0;
    const filledLength = Math.floor(this.barLength * percentage);
    const emptyLength = this.barLength - filledLength;
    
    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = this.current / elapsed;
    const eta = this.total > this.current ? (this.total - this.current) / rate : 0;
    
    const percentageStr = (percentage * 100).toFixed(1).padStart(5);
    const currentStr = this.current.toString().padStart(this.total.toString().length);
    const etaStr = eta > 0 ? `ETA: ${this.formatTime(eta)}` : '';
    
    process.stdout.write(
      `\r${this.name}: [${filledBar}${emptyBar}] ${percentageStr}% (${currentStr}/${this.total}) ${etaStr}  `
    );
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.floor(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${minutes}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  complete(): void {
    this.current = this.total;
    this.render();
    console.log(' ✓');
  }
}