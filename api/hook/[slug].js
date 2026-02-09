export default async function handler(req, res) {
  const { slug } = req.query

  res.status(200).json({
    status: 'ok',
    message: 'HookSpy webhook endpoint placeholder',
    slug,
    method: req.method,
    timestamp: new Date().toISOString(),
  })
}
