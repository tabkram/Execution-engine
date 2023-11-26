import { Node, NodeData } from './trace.model';
import { TraceableExecution } from './traceableExecution';

describe('TraceableExecution', () => {
  describe('TraceableExecution without initialTrace', () => {
    let traceableExecution: TraceableExecution;

    beforeEach(() => {
      traceableExecution = new TraceableExecution();
    });

    it('should create a trace of consecutive calls', async () => {
      function registerUser(username: string, password: string) {
        if (username && password) {
          return Promise.resolve(`User ${username} successfully registered`);
        } else {
          Promise.reject('Invalid registration information');
        }
      }

      function loginUser(username: string, password: string) {
        if (username && password) {
          return `User ${username} successfully logged in`;
        } else {
          throw new Error('Invalid login credentials');
        }
      }

      function getUserInformation(username: string) {
        const userInfo = {
          fullName: 'John Doe',
          email: 'john.doe@example.com',
          role: 'User'
        };
        return `User Information for ${username}: Full Name - ${userInfo.fullName}, Email - ${userInfo.email}, Role - ${userInfo.role}`;
      }

      // Sequential consecutive calls for user registration, login, and retrieving user information
      const newUser = {
        username: 'john_doe',
        password: 'secure_password'
      };
      await traceableExecution.run(registerUser, [newUser.username, newUser.password]);
      traceableExecution.run(loginUser, [newUser.username, newUser.password]);
      traceableExecution.run(getUserInformation, [newUser.username]);

      // Retrieve the trace
      const finalTrace = traceableExecution.getTrace();

      // Perform assertions on the finalTrace
      expect(finalTrace?.length).toEqual(5);
      expect(finalTrace?.filter((n) => n.group === 'nodes')?.length).toEqual(3);
      expect(finalTrace?.filter((n) => n.group === 'edges')?.length).toEqual(2);
    });

    it('should create a trace of fetching data simultaneously from two functions using Promise.all', async () => {
      async function fetchCurrentTemperature(city: string) {
        return Promise.resolve(`Current Temperature in ${city}: 25°C`);
      }

      async function fetchDailyForecast(city: string) {
        return Promise.resolve(`Daily Forecast in ${city}: Sunny`);
      }

      async function getWeatherInformation(city: string, trace?: NodeData) {
        const [temperature, forecast] = await Promise.all([
          (
            await traceableExecution.run(fetchCurrentTemperature, [city], {
              trace: { parent: trace?.id },
              config: { parallel: true, traceExecution: true }
            })
          )?.outputs,
          (
            await traceableExecution.run(fetchDailyForecast, [city], {
              trace: { parent: trace?.id },
              config: { parallel: true, traceExecution: true }
            })
          )?.outputs
        ]);

        return Promise.resolve(`Weather information: ${temperature}, ${forecast}`);
      }

      // Simulate some parallel execution
      await traceableExecution.run(getWeatherInformation, ['Paris']);
      // Retrieve the trace
      const finalTrace = traceableExecution.getTrace();
      expect(finalTrace?.filter((n) => n.group === 'nodes')?.length).toEqual(3);
      expect(finalTrace?.filter((n) => n.group === 'edges')?.length).toEqual(0);
      // Perform assertions on the finalTrace
      expect(finalTrace).toMatchObject([
        {
          data: {
            id: expect.stringMatching(/^getWeatherInformation_.*$/),
            label: 'getWeatherInformation',
            parallel: false,
            abstract: false,
            createTime: expect.any(Date),
            inputs: ['Paris'],
            outputs: 'Weather information: Current Temperature in Paris: 25°C, Daily Forecast in Paris: Sunny',
            startTime: expect.any(Date),
            endTime: expect.any(Date),
            duration: expect.any(Number),
            elapsedTime: expect.any(String),
            updateTime: expect.any(Date)
          },
          group: 'nodes'
        },
        {
          data: {
            inputs: ['Paris'],
            outputs: 'Current Temperature in Paris: 25°C',
            startTime: expect.any(Date),
            endTime: expect.any(Date),
            duration: expect.any(Number),
            elapsedTime: expect.any(String),
            id: expect.stringMatching(/^fetchCurrentTemperature_.*$/),
            label: '1 - fetchCurrentTemperature',
            parent: expect.stringMatching(/^getWeatherInformation_.*$/),
            parallel: true,
            abstract: false,
            createTime: expect.any(Date)
          },
          group: 'nodes'
        },
        {
          data: {
            inputs: ['Paris'],
            outputs: 'Daily Forecast in Paris: Sunny',
            startTime: expect.any(Date),
            endTime: expect.any(Date),
            duration: expect.any(Number),
            elapsedTime: expect.any(String),
            id: expect.stringMatching(/^fetchDailyForecast_.*$/),
            label: '3 - fetchDailyForecast',
            parent: expect.stringMatching(/^getWeatherInformation_.*$/),
            parallel: true,
            abstract: false,
            createTime: expect.any(Date)
          },
          group: 'nodes'
        }
      ]);
    });

    it('should add narratives to a trace node, append narratives, and verify the updated trace and ordered narratives', () => {
      // Define a sample function
      const sampleFunction = (param: string) => `Result: ${param}`;

      // Run the sample function using the run method and create nodes in the trace
      const nodeId = 'sampleFunction_custom_id_1';
      traceableExecution.run(sampleFunction, ['InputParam'], {
        trace: { id: nodeId, narratives: ['Narrative 0'] },
        config: {
          traceExecution: {
            narratives: (res) => {
              return [`Narrative 0 with ${res.outputs}`];
            }
          }
        }
      });
      traceableExecution.run(sampleFunction, ['InputParam2'], {
        trace: {
          id: 'sampleFunction_custom_id_2',
          narratives: ['Narrative 0 for function 2']
        }
      });

      const trace = traceableExecution.getTrace();
      expect(trace?.length).toEqual(3);

      // Use pushNarrative to add a single narrative to the specified node
      traceableExecution.pushNarrative(nodeId, 'Narrative 1');

      // Check if the narrative was added successfully
      const nodeWithNarrative = traceableExecution.getTraceNodes().find((node) => node.data.id === nodeId);
      expect(nodeWithNarrative?.data.narratives).toEqual(['Narrative 0', 'Narrative 0 with Result: InputParam', 'Narrative 1']);

      // Use appendNarratives to add an array of narratives to the same node
      traceableExecution.appendNarratives(nodeId, ['Narrative 2', 'Narrative 3']);

      // Check if the narratives were appended successfully
      const nodeWithAppendedNarratives = traceableExecution.getTraceNodes().find((node) => node.data.id === nodeId);
      expect(nodeWithAppendedNarratives?.data.narratives).toEqual([
        'Narrative 0',
        'Narrative 0 with Result: InputParam',
        'Narrative 1',
        'Narrative 2',
        'Narrative 3'
      ]);

      // Get the ordered narratives and verify their content
      const orderedNarratives = traceableExecution.getOrderedNarratives();
      expect(orderedNarratives).toEqual([
        'Narrative 0',
        'Narrative 0 with Result: InputParam',
        'Narrative 1',
        'Narrative 2',
        'Narrative 3',
        'Narrative 0 for function 2'
      ]);
    });

    it('should enhance trace details for a sample function', () => {
      const sampleFunction = (param: string) => `Result: ${param}`;
      // Run the sample function using the run method and create nodes in the trace
      const traceExecutionConfig = {
        inputs: (i) => 'better input for trace: ' + i,
        outputs: (o) => 'better output for trace: ' + o,
        narratives: (res) => {
          return [`Narrative 0 with ${res.outputs}`];
        }
      };
      const nodeId = 'sampleFunction_custom_id_1';
      traceableExecution.run(sampleFunction, ['InputParam', 'InputParam2'], {
        trace: { id: nodeId, narratives: ['Narrative 0'], label: 'sampleFunction' },
        config: { traceExecution: traceExecutionConfig }
      });

      const nodeId2 = 'sampleFunction_custom_id_2';
      traceableExecution.run(sampleFunction, ['InputParam', 'InputParam2'], {
        trace: {
          id: nodeId2,
          narratives: ['Narrative 0'],
          label: 'sampleFunction2',
          inputs: ['overwritten InputParam', ' just for logging'],
          outputs: ['overwritten InputParam', ' just for logging output']
        },
        config: { traceExecution: { ...traceExecutionConfig, startTime: true, endTime: true } }
      });

      const nodeId3 = 'sampleFunction_custom_id_3';
      traceableExecution.run(sampleFunction, ['InputParam', 'InputParam2'], {
        trace: {
          id: nodeId3,
          narratives: ['Narrative 0'],
          label: 'sampleFunction3',
          inputs: 'custom input not traced'
        },
        config: { traceExecution: false }
      });

      const trace = traceableExecution.getTrace();
      expect(trace?.length).toEqual(5);
      expect(trace?.find((n) => n.group === 'nodes' && n.data.id === nodeId)).toEqual({
        data: {
          id: expect.stringMatching(/^sampleFunction_.*$/),
          label: 'sampleFunction',
          inputs: 'better input for trace: InputParam,InputParam2',
          outputs: 'better output for trace: Result: InputParam',
          errors: undefined,
          narratives: ['Narrative 0', 'Narrative 0 with Result: InputParam'],
          parallel: undefined,
          startTime: undefined,
          endTime: undefined,
          duration: undefined,
          elapsedTime: undefined,
          abstract: false,
          createTime: expect.any(Date)
        },
        group: 'nodes'
      });

      expect(trace?.find((n) => n.group === 'nodes' && n.data.id === nodeId2)).toEqual({
        data: {
          id: expect.stringMatching(/^sampleFunction_.*$/),
          label: 'sampleFunction2',
          inputs: 'better input for trace: overwritten InputParam, just for logging',
          outputs: 'better output for trace: overwritten InputParam, just for logging output',
          errors: undefined,
          narratives: ['Narrative 0', 'Narrative 0 with overwritten InputParam, just for logging output'],
          parallel: undefined,
          startTime: expect.any(Date),
          endTime: expect.any(Date),
          duration: expect.any(Number),
          elapsedTime: expect.any(String),
          abstract: false,
          createTime: expect.any(Date)
        },
        group: 'nodes'
      });

      expect(trace?.find((n) => n.group === 'nodes' && n.data.id === nodeId3)).toEqual({
        data: {
          id: expect.stringMatching(/^sampleFunction_.*$/),
          label: 'sampleFunction3',
          abstract: false,
          parallel: undefined,
          createTime: expect.any(Date)
        },
        group: 'nodes'
      });
    });
  });

  describe('TraceableExecution with initialTrace', () => {
    it('should run with initial trace and then get the trace', async () => {
      // Create a sample initial trace
      const initialTrace = [
        {
          group: 'nodes',
          data: {
            id: 'node_1',
            label: 'Node 1'
          }
        } as Node
      ];

      // Create an instance of TraceableExecution with the initial trace
      const traceableExecution = new TraceableExecution(initialTrace);

      // Define a function to be used in the run method
      const sampleFunction = (param: string) => {
        return `Result: ${param}`;
      };

      // Run the function using the run method
      const executionResult = traceableExecution.run(sampleFunction, ['InputParam']);

      // Assert that the execution result is as expected
      expect(executionResult).toBeDefined();
      expect(executionResult.outputs).toEqual('Result: InputParam');

      // Now, get the trace and assert that it includes a sampleFunction node
      const finalTrace = traceableExecution.getTrace();
      expect(finalTrace?.length).toEqual(3);
      expect(finalTrace?.filter((n) => n.group === 'nodes')?.length).toEqual(2);
      expect(finalTrace?.filter((n) => n.group === 'edges')?.length).toEqual(1);

      const nodes = traceableExecution.getTraceNodes();
      expect(nodes?.length).toEqual(finalTrace?.filter((n) => n.group === 'nodes')?.length);

      // Perform assertions on the finalTrace
      expect(finalTrace).toMatchObject([
        ...initialTrace,
        {
          data: {
            id: expect.stringMatching(/^sampleFunction_.*$/),
            label: 'sampleFunction',
            inputs: ['InputParam'],
            outputs: 'Result: InputParam',
            parallel: false,
            startTime: expect.any(Date),
            endTime: expect.any(Date),
            duration: expect.any(Number),
            elapsedTime: expect.any(String),
            abstract: false,
            createTime: expect.any(Date)
          },
          group: 'nodes'
        },
        {
          data: {
            id: expect.stringMatching(/^node_1->sampleFunction_.*$/),
            source: 'node_1',
            target: expect.stringMatching(/^sampleFunction_.*$/)
          },
          group: 'edges'
        }
      ]);
    });
  });
});
