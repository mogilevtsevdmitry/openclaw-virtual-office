import { DomainEvent } from './domain-event.base';
import { Entity } from './entity.base';

export abstract class AggregateRoot<TId = string> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];
  protected _version: number = 0;

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }

  get version(): number {
    return this._version;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  protected incrementVersion(): void {
    this._version++;
  }
}
