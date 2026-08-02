import { useEffect, useState } from 'react';

import { useSpreadsheet } from '#hooks/useSpreadsheet';

type ReportFactory<T> = (
  spreadsheet: ReturnType<typeof useSpreadsheet>,
  setData: (results: T) => void,
) => Promise<void>;

type ReportPairState<TFirst, TSecond> =
  | { status: 'loading' | 'error'; data: null }
  | {
      status: 'ready';
      data: { first: TFirst; second: TSecond };
    };

export function useReport<T>(
  sheetName: string,
  getData: ReportFactory<T>,
): T | null {
  const spreadsheet = useSpreadsheet();
  const [results, setResults] = useState<T | null>(null);

  useEffect(() => {
    let didCancel = false;

    // Reset results whenever a new data function is provided so callers
    // can reliably show a loading state instead of stale/partial data.
    setResults(null);

    void getData(spreadsheet, results => {
      if (!didCancel) {
        setResults(results);
      }
    });

    return () => {
      didCancel = true;
    };
  }, [getData, spreadsheet]);
  return results;
}

export function useReportPair<TFirst, TSecond>(
  getFirstData: ReportFactory<TFirst>,
  getSecondData: ReportFactory<TSecond>,
): ReportPairState<TFirst, TSecond> {
  const spreadsheet = useSpreadsheet();
  const [state, setState] = useState<ReportPairState<TFirst, TSecond>>({
    status: 'loading',
    data: null,
  });

  useEffect(() => {
    let didCancel = false;
    let firstResult: { value: TFirst } | null = null;
    let secondResult: { value: TSecond } | null = null;

    setState({ status: 'loading', data: null });

    const firstRequest = getFirstData(spreadsheet, result => {
      firstResult = { value: result };
    });
    const secondRequest = getSecondData(spreadsheet, result => {
      secondResult = { value: result };
    });

    void Promise.allSettled([firstRequest, secondRequest]).then(results => {
      if (didCancel) {
        return;
      }

      const didFail = results.some(result => result.status === 'rejected');
      if (didFail || firstResult === null || secondResult === null) {
        setState({ status: 'error', data: null });
        return;
      }

      setState({
        status: 'ready',
        data: {
          first: firstResult.value,
          second: secondResult.value,
        },
      });
    });

    return () => {
      didCancel = true;
    };
  }, [getFirstData, getSecondData, spreadsheet]);

  return state;
}
