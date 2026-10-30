/**
 * One Euro filter (Casiez, Roussel & Vogel, CHI 2012): an adaptive low-pass filter whose cutoff rises with
 * speed, so a still hand does not jitter and a moving hand does not lag.
 */
const alpha = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private t = 0;

  constructor(
    private minCutoff: number,
    private beta: number,
    private dCutoff = 1,
  ) {}

  /** `t` in seconds. */
  filter(value: number, t: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = t;
      return value;
    }
    const dt = Math.max(1e-3, t - this.t);
    this.t = t;
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }

  reset() {
    this.x = null;
    this.dx = 0;
  }
}

/** A 2D point filtered on each axis. */
export class OneEuroFilter2D {
  private fx: OneEuroFilter;
  private fy: OneEuroFilter;
  constructor(minCutoff: number, beta: number, dCutoff = 1) {
    this.fx = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.fy = new OneEuroFilter(minCutoff, beta, dCutoff);
  }
  filter(x: number, y: number, t: number) {
    return { x: this.fx.filter(x, t), y: this.fy.filter(y, t) };
  }
  reset() {
    this.fx.reset();
    this.fy.reset();
  }
}
