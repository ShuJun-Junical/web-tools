const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
const checkCodes = '10X98765432'

function getCheckCode(value: string) {
  if (!/^\d{17}$/.test(value.slice(0, 17))) return null

  const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0)
  return checkCodes[sum % 11]
}

export function isValidChineseId(value: string) {
  const checkCode = getCheckCode(value)
  return value.length === 18 && checkCode !== null && value[17].toUpperCase() === checkCode
}

export function findInvalidChineseIds(text: string) {
  return text.split(/\r?\n/).flatMap((value, index) => {
    const id = value.trim()
    if (!id || isValidChineseId(id)) return []

    return [{
      line: index + 1,
      id,
      reason: id.length === 18 ? '校验码不对' : '长度不对',
      expectedCheckCode: id.length === 17 || id.length === 18 ? getCheckCode(id) : null,
    }]
  })
}
