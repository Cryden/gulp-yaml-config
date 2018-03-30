'use strict'

/* global require, module */

const _ = require('lodash')
const flow = require('lodash/fp/flow')
const head = require('lodash/fp/head')
const pick = require('lodash/fp/pick')
const keys = require('lodash/fp/keys')
const fs = require('fs')
const sh = require('shelljs')
const yaml = require('js-yaml')
const moment = require('moment')
const args = require('yargs').argv
const timestamp = moment().format('YYYYMMDDHHmmss')
const path = require('path')

var config = {}
var options = {
  multiFile: false,
  environments: {}
}

let environments = config.environments || {}
let envId = getEnvId(config)
let ENVID = envId ? envId.toUpperCase() : undefined
let environmentTypes = environments.static || keys(config)
let environmentType = _.includes(environmentTypes, envId) ? envId : environments.default
config = swapVariables(config)

/**
 * Check exist deafult config files
 *
 * @returns {boolean}
 */

function checkDefaultConfig () {
  if (fs.existsSync('config.yml') || fs.existsSync('config')) {
    return true
  } else {
    return false
  }
}

console.log('Check default config:', checkDefaultConfig())

 /**
 * Load yaml file
 *
 * @param {array} file
 * @returns {obj}
 */

function loadYamlFile (file) {
  try {
    return yaml.load(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    if (!/ENOENT:\s+no such file or directory/.test(e)) {
      console.log('Error Loading ' + file + ':', e)
      throw e
    }
  }
}

console.log('YAML test:', loadYamlFile('test.yml'))

/**
 * Load Yaml files as Config object
 *
 * @param {any} paths
 * @returns {obj}
 */

function loadConfig (paths) {
  let files = []

  for (let i = 0; i < paths.length; i++) {
    if (paths[i].endsWith('.yml')) {
      let keyName = (/([ \w-]+?(?=\.))/.exec(paths[i])[1])
      files[keyName] = path.join(paths[i])
    } else {
      let dirFiles = fs.readdirSync(path.join(paths[i]))
      let dirPath = path.join(paths[i])
      for (let i = 0; i < dirFiles.length; i++) {
        if (dirFiles[i].endsWith('.yml')) {
          let keyName = dirFiles[i].substring(0, dirFiles[i].length - '.yml'.length)
          files[keyName] = path.join(dirPath, dirFiles[i])
        }
      }
    }
  }

  let config = {}

  for (var keyName in files) {
    if (files.hasOwnProperty(keyName)) {
      if (keyName === 'config') {
        config = loadYamlFile(files[keyName])
      } else {
        config[keyName] = loadYamlFile(files[keyName])
      }
    }
  }
  return config
}

console.log('Load config:', loadConfig(['temp1', 'temp/config.yml']))

function getEnvIdFromBranch () {
  try {
    let branch = sh.exec('git status', {
      silent: true
    }).stdout

    if (!branch || _.includes(branch, 'fatal:')) {
      return
    }

    branch = branch.split('\n')[0]
    branch = branch.replace(/^#?\s?On branch ((\w|-|_|\/|.)+)/, '$1')

    if (config.branchRegex) {
      branch = branch.replace(new RegExp(_.trim(config.branchRegex)), '$1')
    }

    return _.trimEnd(_.truncate(branch, {
      length: 13,
      omission: ''
    }), '-')
  } catch (e) {
    console.log('ERR: ', e)
    // Do nothing
  }
}

function getEnvId (obj) {
  return args.env ||
    flow(
      pick(keys(obj)),
      keys,
      head
    )(args) ||
    process.env.ENVIRONMENT_ID ||
    getEnvIdFromBranch()
}

function substitute (file, p) {
  let success = false
  let replaced = p.replace(/\${([\w.-]+)}/g, function (match, term) {
    if (!success) {
      success = _.has(file, term)
    }
    return _.get(file, term) || match
  })
  return {
    success: success,
    replace: replaced
  }
}

function transform (file, obj) {
  let changed = false
  let resultant = _.mapValues(obj, function (p) {
    if (_.isPlainObject(p)) {
      let transformed = transform(file, p)
      if (!changed && transformed.changed) {
        changed = true
      }
      return transformed.result
    }
    if (_.isString(p)) {
      let subbed = substitute(file, p)
      if (!changed && subbed.success) {
        changed = true
      }
      return subbed.replace
    }
    if (_.isArray(p)) {
      for (let i = 0; i < p.length; i++) {
        if (_.isString(p[i])) {
          p[i] = substitute(file, p[i]).replace
        }
      }
    }
    return p
  })
  return {
    changed: changed,
    result: resultant
  }
}

function log () {
  console.log('CONFIG:', envId || '-', environmentType || '-')
}

function load (path) {
  console.log(path)
  config = loadConfig(path)
  config = swapVariables(config)
  return config
}

function requireSettings (settings) {
  let erredSettings = []
  settings = _.isString(settings) ? [settings] : settings
  _.forEach(settings, function (setting) {
    if (!_.has(config, setting)) {
      erredSettings.push(setting)
    }
  })

  if (erredSettings.length > 1) {
    throw new Error('The following settings are required in config.yml: ' + erredSettings.join('; '))
  }

  if (erredSettings.length === 1) {
    throw new Error(erredSettings[0] + ' is required in config.yml')
  }
}

function swapVariables (configFile) {
  function readAndSwap (obj) {
    let altered = false
    do {
      let temp = transform(obj, obj)
      obj = temp.result
      altered = temp.changed
    } while (altered)
    return obj
  }

  let file = options.multiFile ? _.mapValues(configFile, readAndSwap) : configFile
  file = _.merge({},
    file || {},
    file[environmentType] || {}, {
      envId: envId,
      ENVID: ENVID,
      timestamp: timestamp,
      args
    })

  file = readAndSwap(file)
  return file
}

// module.exports.default = load('config')
// module.exports.log = log
// module.exports.require = requireSettings
// module.exports.load = load
