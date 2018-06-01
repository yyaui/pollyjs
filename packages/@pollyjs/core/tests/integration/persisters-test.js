import { setupMocha as setupPolly, Polly } from '../../src';
import setupFetch from '../helpers/setup-fetch';
import Configs from './configs';

const { keys } = Object;

describe('Integration | Persisters', function() {
  for (const name in Configs) {
    const defaults = Configs[name];

    describe(name, function() {
      afterEach(function() {
        return this.polly.persister.deleteRecording(this.polly.recordingId);
      });

      setupPolly(defaults);
      setupFetch(defaults.adapters[0]);

      it('should have the correct schema', async function() {
        const { recordingId, persister } = this.polly;

        this.polly.record();
        await this.fetch('/api/db/foo?order=1');
        await persister.persist();

        const recording = await persister.findRecording(recordingId);
        const entriesKeys = keys(recording.entries);

        // Top Level Schema
        expect(recording.name).to.be.a('string');
        expect(recording.name).to.include('should have the correct schema');
        expect(recording.created_at).to.be.a('string');
        expect(new Date(recording.created_at).toString()).to.not.equal(
          'Invalid Date'
        );
        expect(recording.schema_version).to.be.a('number');
        expect(recording.entries).to.be.an('object');
        expect(entriesKeys).to.not.be.empty;

        // Entry Level Schema
        const entry = recording.entries[entriesKeys[0]];

        expect(entry).to.be.an('array');
        expect(entry).to.not.be.empty;

        // Entry Item Level Schema
        const entryItem = entry[0];
        const { request, response } = entryItem;

        expect(entryItem.created_at).to.be.a('string');
        expect(new Date(entryItem.created_at).toString()).to.not.equal(
          'Invalid Date'
        );

        // Request Level Schema
        expect(request).to.be.an('object');
        expect(request.url).to.be.a('string');
        expect(request.method).to.be.a('string');
        expect(request.headers).to.be.an('object');
        expect(new Date(request.timestamp).toString()).to.not.equal(
          'Invalid Date'
        );

        // Response Level Schema
        expect(response).to.be.an('object');
        expect(response.status).to.be.a('number');
        expect(response.headers).to.be.an('object');
        expect(new Date(response.timestamp).toString()).to.not.equal(
          'Invalid Date'
        );
      });

      it('should add new entries to an existing recording', async function() {
        const { recordingId, recordingName } = this.polly;
        let { persister } = this.polly;

        this.polly.record();
        await this.fetch('/api/db/foo?order=1');
        await persister.persist();

        let savedRecording = await persister.findRecording(recordingId);
        let entryKeys = keys(savedRecording.entries);

        expect(entryKeys.length).to.equal(1);
        expect(savedRecording.entries[entryKeys[0]].length).to.equal(1);

        await this.polly.stop();

        this.polly = new Polly(recordingName, defaults);
        persister = this.polly.persister;

        this.polly.record();
        await this.fetch('/api/db/foo?order=1');
        await this.fetch('/api/db/foo?order=1');
        await this.fetch('/api/db/foo?order=2');
        await persister.persist();

        savedRecording = await persister.findRecording(recordingId);
        entryKeys = keys(savedRecording.entries).sort();

        expect(entryKeys.length).to.equal(2);
        expect(savedRecording.entries[entryKeys[0]].length).to.equal(2);
        expect(savedRecording.entries[entryKeys[1]].length).to.equal(1);
      });
    });

    describe(`${name} | recordFailedRequests set to false`, function() {
      beforeEach(function() {
        this.polly = new Polly(`${name} | with recordFailedRequests`, {
          ...defaults,
          recordFailedRequests: false
        });
      });

      afterEach(function() {
        return this.polly.persister.deleteRecording(this.polly.recordingId);
      });

      setupFetch(defaults.adapters[0]);

      it('should not persist by default when a request fails', async function() {
        let error;

        try {
          await this.fetch('/should-not-exist');
          await this.polly.stop();
        } catch (e) {
          error = e;
        } finally {
          const savedRecording = await this.polly.persister.findRecording(
            this.polly.recordingId
          );

          expect(savedRecording).to.be.null;
          expect(error.message).to.contain('Cannot persist response for');
        }
      });
    });

    describe(`${name} | recordFailedRequests set to true`, function() {
      beforeEach(function() {
        this.polly = new Polly(`${name} | with recordFailedRequests`, defaults);
      });

      afterEach(function() {
        return this.polly.persister.deleteRecording(this.polly.recordingId);
      });

      setupFetch(defaults.adapters[0]);

      it('should not persist by default when a request fails', async function() {
        await this.fetch('/should-not-exist-either');
        await this.fetch('/should-not-exist-also');
        await this.polly.stop();

        const savedRecording = await this.polly.persister.findRecording(
          this.polly.recordingId
        );

        expect(savedRecording).to.be.a('object');
        expect(keys(savedRecording.entries)).to.have.lengthOf(2);
      });
    });
  }
});
