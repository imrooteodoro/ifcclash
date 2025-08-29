# Optional ifc2sql.py for IFC to SQLite conversion
# This file is loaded by the Pyodide worker if present
# Can be empty or contain custom IFC processing logic

import ifcopenshell
import sqlite3
import io

def process_ifc_to_sqlite(file_content, file_name):
    """
    Process IFC file content and convert to SQLite database.
    This is a minimal example - extend as needed.
    """
    try:
        # Create in-memory IFC file from bytes
        ifc_file = ifcopenshell.file.from_string(file_content.decode('utf-8', errors='ignore'))

        # Count entities by type
        entity_counts = {}
        for entity in ifc_file:
            entity_type = entity.is_a()
            entity_counts[entity_type] = entity_counts.get(entity_type, 0) + 1

        # Create in-memory SQLite database
        conn = sqlite3.connect(':memory:')
        cursor = conn.cursor()

        # Create a simple entities table
        cursor.execute('''
            CREATE TABLE entities (
                id INTEGER PRIMARY KEY,
                type TEXT,
                global_id TEXT
            )
        ''')

        # Insert entities
        for entity in ifc_file:
            cursor.execute(
                'INSERT INTO entities (id, type, global_id) VALUES (?, ?, ?)',
                (entity.id(), entity.is_a(), getattr(entity, 'GlobalId', None))
            )

        # Get summary
        total_entities = len(ifc_file)
        unique_types = len(entity_counts)

        conn.commit()
        conn.close()

        return {
            'totalEntities': total_entities,
            'uniqueTypes': unique_types,
            'entityCounts': entity_counts,
            'success': True
        }

    except Exception as e:
        return {
            'error': str(e),
            'success': False
        }
