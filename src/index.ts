import mongoose, {Model, Types} from "mongoose";
import DataLoader from "dataloader";

export const encodeBase64 = (str: string) =>
  Buffer.from(str).toString("base64");
export const decodeBase64 = (str: string) =>
  Buffer.from(str, "base64").toString("ascii");
type DefaultRawDoc = {
  _id: Types.ObjectId;
};
interface ModelData<M extends Model<DefaultRawDoc>> {
  model: M;
  dataloader: DataLoader<Types.ObjectId, GetDocument<M>>;
}

/** The Globally unique ID. */
type ID = string;

type GetDocument<M extends Model<DefaultRawDoc>> = M extends Model<
  any,
  any,
  any,
  any,
  infer D
>
  ? D
  : never;

type ModelHydrater<M extends Model<DefaultRawDoc>> = (
  model: ModelData<M>,
  _id: Types.ObjectId
) => Promise<GetDocument<M> | null>;
type ModelDehydrater<M extends Model<DefaultRawDoc>> = (
  model: M,
  _id: Types.ObjectId
) => ID;
type IDToData<M extends Model<DefaultRawDoc>> = (
  id: ID
) => ModelData<M> | {dataloader: null; model: null};
type IDTo_id = (id: ID) => Types.ObjectId | null;

export interface MongooseGlobalIDContextOptions<
  M extends Model<DefaultRawDoc>
> {
  /** Provide your own hydrater for fetching resources with the model and/or dataloader.*/
  hydrate?: ModelHydrater<M>;
}

export interface MongooseGlobalIDReturn<M extends Model<DefaultRawDoc>> {
  /** Gets the global object Identifier given the model and _id. */
  toID: ModelDehydrater<M>;
  /** A utility function to get the model and dataloader from the ID. */
  data: IDToData<M>;
  /** A utility function to get the _id back from the ID. */
  _id: IDTo_id;
  node: (id: ID) => Promise<GetDocument<M> | null>;
}
export type LoaderArgs<M extends Model<DefaultRawDoc>> = Required<
  Pick<GetDocument<M>, "_id">
>;
async function nodeBatch<M extends Model<DefaultRawDoc>>(
  Model: M,
  keys: readonly Types.ObjectId[]
): Promise<GetDocument<M>[]> {
  // reduce keys to only the allowed key!
  const innerKeys = keys.map((x) => ({["_id"]: x as Types.ObjectId} as const));
  console.log(innerKeys);
  const results = await Model.find().or([...innerKeys]);
  const cursorKeys: string[] = innerKeys.map((x) => x["_id"].toHexString());
  const resultMapping = new Map<string, any>(
    results?.map((x: any) => {
      return [x["_id"].toHexString(), x] as const;
    })
  );
  return cursorKeys.map((key) => {
    return resultMapping.get(key);
  });
}

/** This should be called inside your graphql context for each request since it includes
 * a default dataloader.
 */
export default function getGlobalIDMongooseContext<
  M extends mongoose.Model<any>
>(
  models: M[],
  {hydrate}: MongooseGlobalIDContextOptions<M> = {}
): MongooseGlobalIDReturn<M> {
  const mapping = new Map(
    models.map((model) => {
      const dataloader = new DataLoader<Types.ObjectId, GetDocument<M>, string>(
        (keys) => nodeBatch(model, keys),
        {
          cacheKeyFn: (x) => x.toHexString(),
        }
      );
      return [
        model.modelName,
        {
          model,
          dataloader,
        },
      ];
    })
  );

  return {
    toID(model, _id) {
      return encodeBase64(`${model.modelName}:${_id}`);
    },
    data(id) {
      return (
        mapping.get(decodeBase64(id).split(":")[0]) ?? {
          dataloader: null,
          model: null,
        }
      );
    },
    _id(id) {
      const _id = decodeBase64(id).split(":")[1];
      if (!_id) return null;
      return new Types.ObjectId(_id);
    },
    async node(id) {
      const data = mapping.get(decodeBase64(id).split(":")[0]);
      const _id = decodeBase64(id).split(":")[1];
      if (!data || !_id) return null;
      return (
        (await hydrate?.(data, new Types.ObjectId(_id))) ??
        (await data.dataloader.load(new Types.ObjectId(_id))) ??
        null
      );
    },
  };
}
