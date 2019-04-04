import { from, of, empty, defer, Observable } from 'rxjs';
import { mergeMap, catchError } from 'rxjs/operators';
import { AnyAction } from 'redux';
import { isAction, logAction } from './utils';
import { AC, Deps, ExtractPayload, ActionLike } from './types';

export type EpicResult = Observable<ActionLike> | ActionLike | ActionLike[];

export type HandlerFn = (
  deps: Deps
) => (action: AnyAction) => Observable<EpicResult>;

export type EpicHandler<TAC extends AC> = (
  payload: ExtractPayload<ReturnType<TAC>>,
  deps: Deps,
  action: ReturnType<TAC> & { type: string }
) => EpicResult;

export class Epic {
  handlers: { [x: string]: HandlerFn[] };
  constructor(public epicName: string) {
    this.handlers = {};
  }
  attach(epic: Epic) {
    const subHandlers = epic.handlers;
    Object.keys(subHandlers).forEach(key => {
      this.createKey(key);
      this.handlers[key].push(...subHandlers[key]);
    });
    return this;
  }

  on<TAC extends AC>(ac: TAC, handler: EpicHandler<TAC>) {
    return this.add(ac, handler);
  }
  onMany<TAC extends AC, TAC2 extends AC>(
    ac: [TAC, TAC2],
    handler: EpicHandler<TAC | TAC2>
  ): this;
  onMany<TAC extends AC, TAC2 extends AC, TAC3 extends AC>(
    ac: [TAC, TAC2, TAC3],
    handler: EpicHandler<TAC | TAC2 | TAC3>
  ): this;
  onMany<TAC extends AC, TAC2 extends AC, TAC3 extends AC, TAC4 extends AC>(
    ac: [TAC, TAC2, TAC3, TAC4],
    handler: EpicHandler<TAC | TAC2 | TAC3 | TAC4>
  ): this;
  onMany<
    TAC extends AC,
    TAC2 extends AC,
    TAC3 extends AC,
    TAC4 extends AC,
    TAC5 extends AC
  >(
    ac: [TAC, TAC2, TAC3, TAC4, TAC5],
    handler: EpicHandler<TAC | TAC2 | TAC3 | TAC4 | TAC5>
  ): this;
  onMany(ac: AC[], handler: EpicHandler<AC>) {
    return this.add(ac, handler);
  }

  private createKey(key: string) {
    if (!this.handlers[key]) {
      this.handlers[key] = [];
    }
  }

  private add(ac: AC | AC[], handler: EpicHandler<AC>) {
    const keys = Array.isArray(ac)
      ? ac.map(x => x.toString())
      : [ac.toString()];
    keys.forEach(key => {
      this.createKey(key);
      this.handlers[key].push(deps => {
        return (sourceAction: any) => {
          if (process.env.NODE_ENV === 'development') {
            logAction(name, sourceAction);
          }
          return defer(() => {
            const result = handler(sourceAction.payload, deps, sourceAction);
            if (Array.isArray(result)) {
              return from(result);
            }
            if (isAction(result)) {
              return of(result);
            }
            return result;
          }).pipe(
            catchError(e => {
              console.error('Unhandled epic error on action.', {
                sourceAction,
                epic: name,
              });
              console.error(e.stack);
              return empty();
            }),
            mergeMap((action: any) => {
              if (action == null) {
                console.error('Undefined action returned in epic.', {
                  sourceAction,
                  epic: name,
                });
                return empty();
              }
              if (!isAction(action)) {
                console.error('Invalid action returned in epic.', {
                  sourceAction,
                  action,
                  epic: name,
                });
                return empty();
              }
              return of(action);
            })
          );
        };
      });
    });
    return this;
  }
}
