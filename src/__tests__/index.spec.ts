import GlobalID from "../index";

import {Schema, model, connect} from "mongoose";
import mongoose from "mongoose";
// Connection url
const url = "mongodb://localhost:32785";
// Database Name
const dbName = "global-id-mongoose";

// 1. Create an interface representing a document in MongoDB.
interface User {
  _id: mongoose.Types.ObjectId;
  myId: number;
  name: string;
  email: string;
  avatar?: string;
}

// 2. Create a Schema corresponding to the document interface.
const schema = new Schema<User>({
  myId: Number,
  name: {type: String, required: true},
  email: {type: String, required: true},
  avatar: String,
});

// 3. Create a Model.
const UserModel = model<User>("User", schema); // 3. Create a Model.
const EmptyModel = model<User>("Empty", schema);
const TrickyModel = model<User>("Tricky", schema);

async function run(): Promise<void> {
  // 4. Connect to MongoDB
  const client = await connect(url, {
    dbName,
  });

  await client.connection.db.dropDatabase();

  const doc = new UserModel({
    myId: 1,
    name: "Bill",
    email: "bill@example.com",
    avatar: "https://i.imgur.com/dM7Thhn.png",
  });
  const doc01 = new TrickyModel({
    myId: 1,
    name: "Bill",
    email: "bill@example.com",
    avatar: "https://i.imgur.com/dM7Thhn.png",
  });

  const doc2 = new UserModel({
    myId: 2,
    name: "Jill",
    email: "jill@example.com",
    avatar: "https://i.imgur.com/dM7Thhn.png",
  });
  const doc02 = new TrickyModel({
    myId: 2,
    name: "Jill",
    email: "jill@example.com",
    avatar: "https://i.imgur.com/dM7Thhn.png",
  });

  const doc3 = new UserModel({
    myId: 3,
    name: "Phill",
    email: "Phill@example.com",
    avatar: "https://i.imgur.com/dM7Thhn.png",
  });
  await doc.save();
  await doc01.save();
  await doc2.save();
  await doc02.save();
  await doc3.save();
}

describe("relayPaginate", () => {
  beforeAll(async () => {
    jest.setTimeout(10_000);
    await run();
  });

  afterAll(async () => {
    await UserModel.db.close();
  });

  it("should create and undo id.", async () => {
    const handler = GlobalID([UserModel]);
    const user = await UserModel.findOne({});
    if (!user?._id) return;

    const id = handler.toID(UserModel, user._id);
    const _id = handler._id(id);
    const {model, dataloader} = handler.data(id) ?? {};

    expect(typeof id).toBe("string");
    expect(_id?.equals(user._id)).toBeTruthy();
    expect(model).toBe(UserModel);
  });

  it("should fetch by node dataloader.", async () => {
    const handler = GlobalID([UserModel]);
    const user = await UserModel.findOne({});
    if (!user?._id) return;

    const id = handler.toID(UserModel, user._id);
    const node = await handler.node(id);

    expect(node).toStrictEqual(user);
  });

  it("should fetch via hydrater.", async () => {
    const handler = GlobalID([UserModel], {
      hydrate({model}, _id) {
        return model.findById(_id);
      },
    });
    const user = await UserModel.findOne({});
    if (!user?._id) return;

    const id = handler.toID(UserModel, user._id);
    const node = await handler.node(id);

    expect(node).toStrictEqual(user);
  });

  it("should return null when id is bad.", async () => {
    const handler = GlobalID([UserModel], {
      hydrate({model}, _id) {
        return model.findById(_id);
      },
    });
    const user = await UserModel.findOne({});
    if (!user?._id) return;

    const id = handler.toID(UserModel, new mongoose.Types.ObjectId());
    const node = await handler.node(id);

    expect(node).toBe(null);
  });

  it("should return null when user is deleted.", async () => {
    const handler = GlobalID([UserModel], {
      hydrate({model}, _id) {
        return model.findById(_id);
      },
    });
    const user = await UserModel.findOne({});
    await user?.deleteOne();
    if (!user?._id) return;

    const id = handler.toID(UserModel, user._id);
    const node = await handler.node(id);

    expect(node).toBe(null);
  });

  it("should return null data for bad ids.", async () => {
    const handler = GlobalID([UserModel], {
      hydrate({model}, _id) {
        return model.findById(_id);
      },
    });

    const {dataloader, model} = handler.data("");

    expect(dataloader).toBe(null);
    expect(model).toBe(null);
  });

  it("should return null _id for bad ids.", async () => {
    const handler = GlobalID([UserModel], {
      hydrate({model}, _id) {
        return model.findById(_id);
      },
    });

    const _id = handler._id("");

    expect(_id).toBe(null);
  });

  it("should return null node for bad ids.", async () => {
    const handler = GlobalID([UserModel], {
      hydrate({model}, _id) {
        return model.findById(_id);
      },
    });

    const node = await handler.node("");

    expect(node).toBe(null);
  });
});
