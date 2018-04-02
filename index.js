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

let options = {
  multiFile: false,
  root: 'config'
}

let config = {
  environments: {}
}

let environments = {}

/**
 * Check exist deafult config files
 *
 * @returns {boolean}
 */

function checkDefaultConfig () {
  if (fs.existsSync('config.yml')) {
    return true
  } else {
    return false
  }
}

// console.log('Check default config:', checkDefaultConfig())

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

// console.log('YAML test:', loadYamlFile('test.yml'))

/**
 * Load Yaml files as Config object
 *
 * @param {any} paths
 * @returns {obj}
 */

function loadYamlConfig (paths) {
  paths = paths || []
  if (paths === []) {
    if (checkDefaultConfig()) {
      paths.push('config.yml')
    } else {
      return
    }
  }
  let files = []
  for (let i = 0; i < paths.length; i++) {
    if (paths[i].endsWith('.yml')) {
      if (fs.existsSync(paths[i])) {
        let keyName = (/([ \w-]+?(?=\.))/.exec(paths[i])[1])
        files[keyName] = path.join(paths[i])
      }
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
  if (files === []) {
    return
  }
  for (var keyName in files) {
    if (files.hasOwnProperty(keyName)) {
      if (keyName === options.root) {
        config = loadYamlFile(files[keyName])
      } else {
        config[keyName] = loadYamlFile(files[keyName])
      }
    }
  }
  return config
}

// loadYamlConfig(['temp1', 'temp/config.yml'])
// console.log('Load config:', config)

/**
 * Get EnvId from branch
 *
 * @returns {string}
 */

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
  }
}

// console.log('EnvId from Branch:', getEnvIdFromBranch())

/**
 * Set config environments
 *
 * @param {any} obj
 * @returns
 */

function setEnvironments (config) {
  environments.environments = config.environments || {}
  environments.envId = getEnvId(config)
  environments.ENVID = environments.envId ? environments.envId.toUpperCase() : undefined
  environments.environmentTypes = environments.environments.static || keys(config)
  environments.environmentType = _.includes(environments.environmentTypes, environments.envId) ? environments.envId : environments.environments.default
}

// setEnvironments(loadYamlConfig(['temp1', 'temp/config.yml']))
// console.log('environments:', environments)

/**
 * Set EnvId
 *
 * @param {any} obj
 * @returns {string}
 */

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

// console.log('Set EnvID:', getEnvId(loadYamlConfig(['temp1', 'temp/config.yml'])))

/**
 * Print envID
 *
 */

function log () {
  console.log('CONFIG:', environments.envId || '-', environments.environmentType || '-')
}

function load (path) {
  config = loadYamlConfig(path)
  setEnvironments(config)
  config = swapVariables(config)
  return config
}

// console.log('CONFIG:', load())

/**
 * Swap config
 *
 * @param {any} configFile
 * @returns {obj}
 */

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
  let file = options.multiFile ? _.mapValues(configFile, readAndSwap) : configFile
  file = _.merge({},
    file || {},
    file[environments.environmentType] || {}, {
      envId: environments.envId,
      ENVID: environments.ENVID,
      timestamp: timestamp,
      args
    })
  file = readAndSwap(file)
  return file
}

module.exports.default = load()
module.exports.log = log
module.exports.load = load
