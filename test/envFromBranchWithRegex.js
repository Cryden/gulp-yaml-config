'use strict'

require('should')
const sinon = require('sinon')
const _env = require('./_env.js')
const _load = require('./_load.js')

var clock = sinon.useFakeTimers()
var config = _load('env-w-regex')
var env = _env(true)

describe('Config env from branch with regex', function () {
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

  after(function () {
    clock.restore()
  })
})
