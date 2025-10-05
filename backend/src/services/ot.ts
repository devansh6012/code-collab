import { Operation } from '../types';

/**
 * Operational Transform (OT) Implementation
 * Handles conflict resolution when multiple users edit simultaneously
 */

export class OperationalTransform {
  /**
   * Transform two operations that happened concurrently
   * Returns transformed version of op1 that can be applied after op2
   */
  static transform(op1: Operation, op2: Operation): Operation {
    // Insert vs Insert
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position < op2.position) {
        return op1; // op1 comes before, no change needed
      } else if (op1.position > op2.position) {
        // Shift op1's position by the length of op2's insertion
        return {
          ...op1,
          position: op1.position + (op2.text?.length || 0)
        };
      } else {
        // Same position - use timestamp to decide order
        if (op1.timestamp < op2.timestamp) {
          return op1;
        } else {
          return {
            ...op1,
            position: op1.position + (op2.text?.length || 0)
          };
        }
      }
    }

    // Delete vs Delete
    if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position < op2.position) {
        return op1;
      } else if (op1.position > op2.position) {
        // Shift op1's position back by op2's deletion length
        const newPosition = Math.max(op2.position, op1.position - (op2.length || 0));
        return {
          ...op1,
          position: newPosition
        };
      } else {
        // Same position - whoever deletes more wins, or use timestamp
        if ((op1.length || 0) > (op2.length || 0)) {
          return {
            ...op1,
            length: (op1.length || 0) - (op2.length || 0)
          };
        } else if ((op1.length || 0) < (op2.length || 0)) {
          return { ...op1, length: 0 }; // op2 already deleted this
        } else {
          return op1.timestamp < op2.timestamp ? op1 : { ...op1, length: 0 };
        }
      }
    }

    // Insert vs Delete
    if (op1.type === 'insert' && op2.type === 'delete') {
      if (op1.position <= op2.position) {
        return op1; // Insert comes before delete
      } else if (op1.position > op2.position + (op2.length || 0)) {
        // Insert comes after deleted range
        return {
          ...op1,
          position: op1.position - (op2.length || 0)
        };
      } else {
        // Insert is within deleted range - place at delete position
        return {
          ...op1,
          position: op2.position
        };
      }
    }

    // Delete vs Insert
    if (op1.type === 'delete' && op2.type === 'insert') {
      if (op1.position < op2.position) {
        return op1; // Delete comes before insert
      } else {
        // Shift delete position by insert length
        return {
          ...op1,
          position: op1.position + (op2.text?.length || 0)
        };
      }
    }

    return op1;
  }

  /**
   * Apply an operation to text content
   */
  static apply(content: string, operation: Operation): string {
    if (operation.type === 'insert') {
      const before = content.substring(0, operation.position);
      const after = content.substring(operation.position);
      return before + (operation.text || '') + after;
    } else if (operation.type === 'delete') {
      const before = content.substring(0, operation.position);
      const after = content.substring(operation.position + (operation.length || 0));
      return before + after;
    }
    return content;
  }

  /**
   * Transform an operation against a list of operations
   * Used when applying buffered operations
   */
  static transformAgainst(operation: Operation, against: Operation[]): Operation {
    let transformed = operation;
    for (const op of against) {
      transformed = this.transform(transformed, op);
    }
    return transformed;
  }

  /**
   * Compose multiple operations into one (optimization)
   */
  static compose(ops: Operation[]): Operation[] {
    if (ops.length === 0) return [];
    if (ops.length === 1) return ops;

    const composed: Operation[] = [];
    let current = ops[0];

    for (let i = 1; i < ops.length; i++) {
      const next = ops[i];

      // Try to merge consecutive operations by same user
      if (current.userId === next.userId && current.type === next.type) {
        if (current.type === 'insert' && next.type === 'insert') {
          // Merge consecutive inserts at same position
          if (current.position + (current.text?.length || 0) === next.position) {
            current = {
              ...current,
              text: (current.text || '') + (next.text || ''),
              timestamp: next.timestamp
            };
            continue;
          }
        } else if (current.type === 'delete' && next.type === 'delete') {
          // Merge consecutive deletes
          if (current.position === next.position) {
            current = {
              ...current,
              length: (current.length || 0) + (next.length || 0),
              timestamp: next.timestamp
            };
            continue;
          }
        }
      }

      composed.push(current);
      current = next;
    }

    composed.push(current);
    return composed;
  }
}

export default OperationalTransform;