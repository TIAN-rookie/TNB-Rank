const SUPABASE_CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export async function createCloudBackend(config){
  const {createClient}=await import(SUPABASE_CDN);
  const client=createClient(config.supabaseUrl,config.supabaseAnonKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  const getIdentity=async(userOverride=null)=>{
    let user=userOverride;
    if(!user){
      const {data,error}=await client.auth.getUser();
      if(error&&!error.message?.includes('Auth session missing'))throw error;
      user=data?.user||null;
    }
    if(!user)return {user:null,profile:null,isAdmin:false};
    const {data:profiles,error}=await client.from('profiles').select('role,display_name').eq('id',user.id).limit(1);
    if(error)throw error;
    const profile=profiles?.[0]||null;
    return {user,profile,isAdmin:profile?.role==='admin'};
  };

  const load=async()=>{
    const [playersResult,seasonsResult,gamesResult,resultsResult]=await Promise.all([
      client.from('players').select('*').order('joined_at'),
      client.from('seasons').select('*').order('starts_on',{ascending:false}),
      client.from('games').select('id,played_at,event_name,season_id').order('played_at'),
      client.from('game_results').select('game_id,player_id,points')
    ]);
    for(const result of [playersResult,seasonsResult,gamesResult,resultsResult])if(result.error)throw result.error;
    const seasonCodeById=new Map(seasonsResult.data.map(season=>[season.id,season.code]));
    const scoresByGame=new Map();
    for(const result of resultsResult.data){
      if(!scoresByGame.has(result.game_id))scoresByGame.set(result.game_id,{});
      scoresByGame.get(result.game_id)[result.player_id]=result.points;
    }
    return {
      players:playersResult.data.map(player=>({id:player.id,name:player.name,tagline:player.tagline,color:player.color,avatar:player.avatar_url,joined:player.joined_at})),
      seasons:seasonsResult.data.map(season=>({id:season.id,code:season.code,name:season.name,active:season.is_active})),
      games:gamesResult.data.filter(game=>seasonCodeById.has(game.season_id)).map(game=>({
        id:game.id,date:game.played_at,event:game.event_name,season:seasonCodeById.get(game.season_id),
        scores:scoresByGame.get(game.id)||{}
      }))
    };
  };

  const addPlayer=async(player,avatarData)=>{
    const identity=await getIdentity();
    if(!identity.isAdmin)throw new Error('请先使用管理员账号登录');
    const playerId=crypto.randomUUID();
    let avatarUrl=null;
    if(avatarData){
      const blob=await (await fetch(avatarData)).blob();
      const path=`${playerId}/avatar.jpg`;
      const {error:uploadError}=await client.storage.from('avatars').upload(path,blob,{contentType:'image/jpeg',upsert:true});
      if(uploadError)throw uploadError;
      avatarUrl=client.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    }
    const {error}=await client.from('players').insert({id:playerId,name:player.name,tagline:player.tagline,color:player.color,avatar_url:avatarUrl,created_by:identity.user.id});
    if(error)throw error;
  };

  const addGame=async(game)=>{
    const {error}=await client.rpc('create_game_with_results',{
      p_season_code:game.season,p_played_at:game.date,p_event_name:game.event,
      p_results:Object.entries(game.scores).map(([player_id,points])=>({player_id,points:Number(points)}))
    });
    if(error)throw error;
  };

  const signIn=async(email,password)=>{
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error)throw error;
    return getIdentity(data?.user||null);
  };
  const signOut=async()=>{const {error}=await client.auth.signOut();if(error)throw error};
  const subscribe=onChange=>{
    let timer;
    const channel=client.channel('tnb-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'players'},()=>{clearTimeout(timer);timer=setTimeout(onChange,700)})
      .on('postgres_changes',{event:'*',schema:'public',table:'games'},()=>{clearTimeout(timer);timer=setTimeout(onChange,700)})
      .on('postgres_changes',{event:'*',schema:'public',table:'game_results'},()=>{clearTimeout(timer);timer=setTimeout(onChange,700)})
      .subscribe();
    return ()=>client.removeChannel(channel);
  };
  return {load,getIdentity,addPlayer,addGame,signIn,signOut,subscribe,onAuthChange:callback=>client.auth.onAuthStateChange(callback)};
}
