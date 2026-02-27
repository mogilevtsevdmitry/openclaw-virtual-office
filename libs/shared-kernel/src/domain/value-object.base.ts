export abstract class ValueObject<TProps> {
  protected readonly props: TProps;

  constructor(props: TProps) {
    this.props = Object.freeze(props);
    this.validate(props);
  }

  protected abstract validate(props: TProps): void;

  equals(other: ValueObject<TProps>): boolean {
    if (!(other instanceof ValueObject)) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }

  getValue(): TProps {
    return this.props;
  }
}
