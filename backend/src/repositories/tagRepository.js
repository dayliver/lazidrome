import { getDB } from '../db.js';

export function getAggregatedTags() {
  const db = getDB();
  const query = `
    SELECT tag_name, SUM(cnt) as count 
    FROM (
      SELECT value as tag_name, COUNT(*) as cnt 
      FROM track_metadata, json_each(tags) 
      WHERE tags IS NOT NULL AND tags != '[]' 
      GROUP BY value
      
      UNION ALL
      
      SELECT value as tag_name, COUNT(*) as cnt 
      FROM albums, json_each(tags) 
      WHERE tags IS NOT NULL AND tags != '[]' 
      GROUP BY value
      
      UNION ALL
      
      SELECT value as tag_name, COUNT(*) as cnt 
      FROM artists, json_each(tags) 
      WHERE tags IS NOT NULL AND tags != '[]' 
      GROUP BY value
    )
    GROUP BY tag_name
    ORDER BY count DESC
  `;

  return db.prepare(query).all();
}