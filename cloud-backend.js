const SUPABASE_CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export async function createCloudBackend(config){
  const {createClient}=await import(SUPABASE_CDN);
  const client=createClient(config.supabaseUrl,config.supabaseAnonKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  const getIdentity=async()=>{
    const {data:{session}}=await client.auth.getSession();
    if(!session)return {user:null,isAdmin:false};
    const {data:profile,error}=await client.from('profiles').select('role,display_name').eq('id',session.user.id).single();
    if(error)throw error;
    return {user:session.user,profile,isAdmin:profile.role==='admin'};
  };

  const load=async()=>{
    const [playersResult,seasonsResult,gamesResult]=await Promise.all([
      client.from('players').select('*').order('joined_at'),
      client.from('seasons').select('*').order('starts_on',{ascending:false}),
      client.from('games').select('id,played_at,event_name,season_id,seasons(code),game_results(player_id,points)').order('played_at')
    ]);
    for(const result of [playersResult,seasonsResult,gamesResult])if(result.error)throw result.error;
    return {
      players:playersResult.data.map(player=>({id:player.id,name:player.name,tagline:player.tagline,color:player.color,avatar:player.avatar_url,joined:player.joined_at})),
      seasons:seasonsResult.data.map(season=>({id:season.id,code:season.code,name:season.name,active:season.is_active})),
      games:gamesResult.data.map(game=>({
        id:game.id,date:game.played_at,event:game.event_name,season:game.seasons.code,
        scores:Object.fromEntries(game.game_results.map(result=>[result.player_id,result.points]))
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
    const {error}=await client.auth.signInWithPassword({email,password});
    if(error)throw error;
    return getIdentity();
  };
  const signOut=async()=>{const {error}=await client.auth.signOut();if(error)throw error};
  const subscribe=onChange=>{
    let timer;
    const channel=client.channel('tnb-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'players'},()=>{clearTimeout(timer);timer=setTimeout(onChange,250)})
      .on('postgres_changes',{event:'*',schema:'public',table:'games'},()=>{clearTimeout(timer);timer=setTimeout(onChange,250)})
      .on('postgres_changes',{event:'*',schema:'public',table:'game_results'},()=>{clearTimeout(timer);timer=setTimeout(onChange,250)})
      .subscribe();
    return ()=>client.removeChannel(channel);
  };
  return {load,getIdentity,addPlayer,addGame,signIn,signOut,subscribe,onAuthChange:callback=>client.auth.onAuthStateChange(callback)};
}
