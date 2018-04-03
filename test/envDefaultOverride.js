'use strict'

require('should')
const decache = require('decache')
decache('js-yaml')
decache('yargs')
delete require.cache[require.resolve('../')]

let env = 'unknown'
process.env.ENVIRONMENT_ID = env
let path = 'test/configs/env.yml'
let config = require('../').load(path, {root: 'env'})

describe('Config env with default override', function () {
  it('should override env variables at top', function () {
    config.setting1.should.equal('dummyVal')
  })

  it('should override env variables in obj', function () {
    config.obj1.obj2.setting1.should.equal('objsettingVal1')
  })

  it('should override env variables in list', function () {
    config.settingList1.should.have.length(2)
    config.settingList1[0].should.equal('one')
  })

  delete process.env.ENVIRONMENT_ID
})
