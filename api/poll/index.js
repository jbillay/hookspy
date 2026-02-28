import { supabase } from '../_lib/supabase.js'
import { verifyAuth } from '../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../_lib/cors.js'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  setCorsHeaders(req, res)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user, error: authError } = await verifyAuth(req)
  if (authError || !user) {
    return res.status(401).json({ error: authError || 'Unauthorized' })
  }

  const { since, endpoint_ids: endpointIdsParam } = req.query

  if (!since) {
    return res.status(400).json({ error: 'Missing required parameter: since' })
  }

  if (!endpointIdsParam) {
    return res
      .status(400)
      .json({ error: 'Missing required parameter: endpoint_ids' })
  }

  const parsedSince = new Date(since)
  if (isNaN(parsedSince.getTime())) {
    return res
      .status(400)
      .json({ error: 'Invalid since parameter: must be ISO 8601 timestamp' })
  }

  const endpointIds = endpointIdsParam.split(',').filter(Boolean)
  if (endpointIds.length === 0) {
    return res
      .status(400)
      .json({ error: 'Missing required parameter: endpoint_ids' })
  }

  for (const id of endpointIds) {
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid endpoint_ids format' })
    }
  }

  // Validate endpoint ownership
  const { data: ownedEndpoints, error: ownershipError } = await supabase
    .from('endpoints')
    .select('id')
    .in('id', endpointIds)
    .eq('user_id', user.id)

  if (ownershipError) {
    console.error('[poll] ownership check error:', ownershipError)
    return res.status(500).json({ error: 'Internal server error' })
  }

  if (!ownedEndpoints || ownedEndpoints.length !== endpointIds.length) {
    return res.status(403).json({ error: 'Unauthorized endpoint access' })
  }

  try {
    // Query new inserts (received after since)
    const { data: inserts, error: insertError } = await supabase
      .from('webhook_logs')
      .select('*')
      .gt('received_at', since)
      .in('endpoint_id', endpointIds)
      .order('received_at', { ascending: true })
      .limit(100)

    if (insertError) {
      console.error('[poll] insert query error:', insertError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    // Query updates (modified after since but created before since)
    const { data: updates, error: updateError } = await supabase
      .from('webhook_logs')
      .select('*')
      .gt('updated_at', since)
      .lte('received_at', since)
      .in('endpoint_id', endpointIds)
      .order('updated_at', { ascending: true })
      .limit(100)

    if (updateError) {
      console.error('[poll] update query error:', updateError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json({
      inserts: inserts || [],
      updates: updates || [],
      server_time: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[poll] unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
