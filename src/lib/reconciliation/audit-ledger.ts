import { v4 as uuidv4 } from 'uuid';
import { AuditLogEntry } from '../types/treasury';

export class AuditLedger {
  private static instance: AuditLedger;
  private entries: AuditLogEntry[] = [];

  private constructor() {}

  static getInstance(): AuditLedger {
    if (!AuditLedger.instance) {
      AuditLedger.instance = new AuditLedger();
    }
    return AuditLedger.instance;
  }

  log(
    eventType: AuditLogEntry['eventType'],
    details: Record<string, any>,
    actor: AuditLogEntry['actor'],
    severity: AuditLogEntry['severity'] = 'INFO'
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `AUD-${Date.now()}-${uuidv4().substring(0, 6)}`,
      timestamp: new Date().toISOString(),
      eventType,
      severity,
      details,
      actor,
    };
    this.entries.push(entry);
    return entry;
  }

  getEntries(): AuditLogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}
