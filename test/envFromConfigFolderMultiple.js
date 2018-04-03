'use strict'

require('should')
const decache = require('decache')
let path = ['test/configs/substitution.yml', 'test/configs/basic.yml']
let config

describe('Config (from folder) with multiple files', function () {
  describe('with no arguments', function () {
    decache('js-yaml')
    decache('yargs')
    delete require.cache[require.resolve('../')]
    config = require('../').load(path)
    it('should house both files', function () {
      config.basic.var1.should.equal('val1')
      config.substitution.foo.should.equal('fooval')
    })
    it('should be able to use cross file references', function () {
      config.substitution.sub6.should.equal(config.basic.var1)
    })
    it('should still allow regular variable substitution', function () {
      config.substitution.sub.bar.foo.should.equal(config.substitution.bar.foo)
    })
  })
  describe('with --env arguments', function () {
    decache('js-yaml')
    decache('yargs')
    process.argv.push('--env')
    process.argv.push('substitution')
    delete require.cache[require.resolve('../')]
    config = require('../').load(path)
    it('should house both files', function () {
      config.basic.var1.should.equal('val1')
      config.substitution.foo.should.equal('fooval')
    })
    it('env should be root element', function () {
      config.foo.should.equal('fooval')
    })

    process.argv.pop()
    process.argv.pop()
  })
  describe('with --[env] arguments', function () {
    decache('js-yaml')
    decache('yargs')
    process.argv.push('--substitution')
    delete require.cache[require.resolve('../')]
    config = require('../').load(path)
    it('should house both files', function () {
      config.basic.var1.should.equal('val1')
      config.substitution.foo.should.equal('fooval')
    })
    it('env should be root element', function () {
      config.foo.should.equal('fooval')
    })
    process.argv.pop()
  })
  console.log(process.argv)
})
