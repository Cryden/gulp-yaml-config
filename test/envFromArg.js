'use strict'

require('should')
const decache = require('decache')
decache('js-yaml')
decache('yargs')
delete require.cache[require.resolve('../')]

let env = 'argenv'
process.argv.push('--env')
process.argv.push(env)
let path = 'test/configs/env.yml'
let config = require('../').load(path, {root: 'env'})

describe('Config env from arg', function () {
  it('should have env variables at top', function () {
    config.lower.should.equal(env)
    config.upper.should.equal(env.toUpperCase())
  })

  it('should have env variables in obj', function () {
    config.obj1.obj2.lower.should.equal(env)
    config.obj1.obj2.upper.should.equal(env.toUpperCase())
  })

  it('should have env variables in obj', function () {
    config.list1[0].should.equal(env)
    config.list1[1].should.equal(env.toUpperCase())
  })
  process.argv.pop()
  process.argv.pop()
})
