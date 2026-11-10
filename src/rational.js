function absBigInt(value) {
  return value < 0n ? -value : value;
}

function gcd(first, second) {
  let a = absBigInt(first);
  let b = absBigInt(second);
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

export class Rational {
  constructor(numerator, denominator = 1n) {
    let n = BigInt(numerator);
    let d = BigInt(denominator);
    if (d === 0n) throw new RangeError("A rational denominator cannot be zero");
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const divisor = gcd(n, d);
    this.n = n / divisor;
    this.d = d / divisor;
    Object.freeze(this);
  }

  add(other) {
    const value = rational(other);
    return new Rational(this.n * value.d + value.n * this.d, this.d * value.d);
  }

  sub(other) {
    const value = rational(other);
    return new Rational(this.n * value.d - value.n * this.d, this.d * value.d);
  }

  mul(other) {
    const value = rational(other);
    return new Rational(this.n * value.n, this.d * value.d);
  }

  div(other) {
    const value = rational(other);
    if (value.n === 0n) throw new RangeError("Division by zero");
    return new Rational(this.n * value.d, this.d * value.n);
  }

  neg() {
    return new Rational(-this.n, this.d);
  }

  compare(other) {
    const value = rational(other);
    const difference = this.n * value.d - value.n * this.d;
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  }

  equals(other) {
    return this.compare(other) === 0;
  }

  isZero() {
    return this.n === 0n;
  }

  toNumber() {
    if (this.n === 0n) return 0;
    const sign = this.n < 0n ? -1 : 1;
    const numerator = absBigInt(this.n);
    const numeratorBits = numerator.toString(2).length;
    const denominatorBits = this.d.toString(2).length;
    const numeratorShift = Math.max(0, numeratorBits - 53);
    const denominatorShift = Math.max(0, denominatorBits - 53);
    const numeratorMantissa = Number(numerator >> BigInt(numeratorShift));
    const denominatorMantissa = Number(this.d >> BigInt(denominatorShift));
    return sign * (numeratorMantissa / denominatorMantissa) *
      (2 ** (numeratorShift - denominatorShift));
  }

  toString() {
    return this.d === 1n ? String(this.n) : `${this.n}/${this.d}`;
  }
}

export function rational(value, denominator = 1n) {
  return value instanceof Rational ? value : new Rational(value, denominator);
}

export const ZERO = new Rational(0n);
export const ONE = new Rational(1n);
