const tokenPayload = {
  'caramelosec-token': 'edfc424b-f7ce-47bd-bc30-5df0435a4a8a',
}

module.exports = (_req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.status(200).send(JSON.stringify(tokenPayload))
}
