import LatexLogParser from '../log-parser/latex-log-parser'
import ruleset from './HumanReadableLogsRules'

export default {
  parse(rawLog, options) {
    let parsedLogEntries
    if (typeof rawLog === 'string') {
      const latexLogParser = new LatexLogParser(rawLog, options)
      parsedLogEntries = latexLogParser.parse()
    } else {
      parsedLogEntries = rawLog
    }

    const _getRule = function (logMessage) {
      for (const rule of ruleset) {
        if (rule.regexToMatch.test(logMessage)) {
          return rule
        }
      }
    }

    const seenErrorTypes = {} // keep track of types of errors seen

    for (const entry of parsedLogEntries.all) {
      const ruleDetails = _getRule(entry.message)

      if (ruleDetails != null) {
        var type
        if (ruleDetails.ruleId != null) {
          entry.ruleId = ruleDetails.ruleId
        } else if (ruleDetails.regexToMatch != null) {
          entry.ruleId = `hint_${ruleDetails.regexToMatch
            .toString()
            .replace(/\s/g, '_')
            .slice(1, -1)}`
        }
        if (ruleDetails.newMessage != null) {
          entry.message = entry.message.replace(
            ruleDetails.regexToMatch,
            ruleDetails.newMessage
          )
        }
        // suppress any entries that are known to cascade from previous error types
        if (ruleDetails.cascadesFrom != null) {
          for (type of ruleDetails.cascadesFrom) {
            if (seenErrorTypes[type]) {
              entry.suppressed = true
            }
          }
        }
        // record the types of errors seen
        if (ruleDetails.types != null) {
          for (type of ruleDetails.types) {
            seenErrorTypes[type] = true
          }
        }

        if (ruleDetails.humanReadableHint != null) {
          entry.humanReadableHint = ruleDetails.humanReadableHint
        }

        if (ruleDetails.humanReadableHintComponent != null) {
          entry.humanReadableHintComponent =
            ruleDetails.humanReadableHintComponent
        }

        if (ruleDetails.extraInfoURL != null) {
          entry.extraInfoURL = ruleDetails.extraInfoURL
        }
      }
    }

    // filter out the suppressed errors (from the array entries in parsedLogEntries)
    for (const key in parsedLogEntries) {
      const errors = parsedLogEntries[key]
      if (typeof errors === 'object' && errors.length > 0) {
        parsedLogEntries[key] = Array.from(errors).filter(
          err => !err.suppressed
        )
      }
    }

    return parsedLogEntries
  },
}
